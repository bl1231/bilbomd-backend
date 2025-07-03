import { Request, Response } from 'express'
import axios from 'axios'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { issueTokensAndSetCookie } from './authTokens.js'
import { logger } from '../../middleware/loggers.js'

type OrcidEmailEntry = { email?: string; verified?: boolean; primary?: boolean }

export async function handleOrcidCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  const storedState = req.cookies.orcid_oauth_state

  if (!code || !state || state !== storedState) {
    res.status(400).send('Invalid or missing authorization parameters')
    return
  }

  try {
    logger.info(`Handling ORCID callback with code: ${code}, and state: ${state}`)

    const redirect_uri = process.env.ORCID_REDIRECT_URI!
    const tokenRes = await axios.post(
      'https://sandbox.orcid.org/oauth/token',
      new URLSearchParams({
        client_id: process.env.ORCID_CLIENT_ID!,
        client_secret: process.env.ORCID_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri
      }),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )
    const tokenSet = tokenRes.data
    if (tokenRes.status !== 200) {
      logger.error('ORCID token exchange error body:', tokenSet)
      throw new Error(`ORCID token exchange failed with status ${tokenRes.status}`)
    }

    logger.info(`Received tokenSet: ${JSON.stringify(tokenSet)}`)

    // Public API: https://pub.sandbox.orcid.org/[version]
    // Member API: https://api.sandbox.orcid.org/[version]

    const userinfoRes = await axios.get(
      `https://pub.sandbox.orcid.org/v3.0/${tokenSet.orcid}`,
      {
        headers: {
          Authorization: `Bearer ${tokenSet.access_token}`,
          Accept: 'application/orcid+json'
        }
      }
    )

    const userinfo = userinfoRes.data
    logger.info(`ORCID user info (via axios): ${JSON.stringify(userinfo)}`)

    const givenName = userinfo.person?.name?.['given-names']?.value
    const familyName = userinfo.person?.name?.['family-name']?.value

    // Extract primary verified email
    const emailList = Array.isArray(userinfo.person?.emails?.email)
      ? userinfo.person.emails.email
      : []

    let selectedEmail: string | undefined
    let emailReason: string | undefined

    if (emailList.length > 0) {
      selectedEmail = (emailList as OrcidEmailEntry[]).find(
        (entry) => entry.primary && entry.verified
      )?.email

      if (!selectedEmail) {
        logger.warn('No primary verified email found. Trying any verified email.')
        selectedEmail = (emailList as OrcidEmailEntry[]).find(
          (entry) => entry.verified
        )?.email
        emailReason = 'no_primary_verified'
      }

      if (!selectedEmail) {
        logger.warn(
          'No verified email found. Using first available email (not recommended).'
        )
        selectedEmail = (emailList as OrcidEmailEntry[])[0]?.email
        emailReason = 'no_verified'
      }
    } else {
      emailReason = 'no_email_list'
    }

    if (!selectedEmail) {
      logger.error('No email address found in ORCID user info')
      return res.redirect(`/auth/orcid/error?reason=${emailReason || 'unknown'}`)
    }

    let user = await User.findOne({
      'oauth.provider': 'orcid',
      'oauth.id': tokenSet.orcid
    })

    if (!user) {
      user = await User.create({
        email: selectedEmail,
        username: selectedEmail?.split('@')[0] || 'orciduser',
        displayName: givenName && familyName ? `${givenName} ${familyName}` : undefined,
        roles: ['User'],
        oauth: [{ provider: 'orcid', id: tokenSet.orcid }],
        refreshTokens: []
      })
    }

    // Clear ORCID OAuth cookies
    res.clearCookie('orcid_oauth_state')
    res.clearCookie('orcid_oauth_nonce')

    issueTokensAndSetCookie(user, res)
    res.redirect('/welcome')
  } catch (err: unknown) {
    logger.error('Error during ORCID token exchange:', err)
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const response = (err as { response?: { text?: () => Promise<string> } }).response

      if (response && typeof response.text === 'function') {
        try {
          const errorText = await response.text()
          logger.error('ORCID token exchange error body:', errorText)
        } catch (readErr) {
          logger.warn('Could not read error response body from ORCID', readErr)
        }
      } else {
        logger.warn('ORCID error response exists but has no .text() method:', response)
      }
    }

    logger.error('ORCID callback error:', err)
    res.status(500).send('Authentication failed')
  }
}
