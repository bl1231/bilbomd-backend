import { Request, Response } from 'express'
import { UserInfoResponse, fetchUserInfo } from 'openid-client'
import axios from 'axios'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { issueTokensAndSetCookie } from './authTokens.js'
import { discovered } from './orcidClientConfig.js'
import { logger } from '../../middleware/loggers.js'

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
      'https://orcid.org/oauth/token',
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

    const claims = tokenSet
    if (!claims || typeof claims !== 'object' || typeof claims.orcid !== 'string') {
      logger.error('Missing or invalid ORCID iD in token response:', claims)
      res.status(400).send('Invalid token response from ORCID')
      return
    }

    const userinfo: UserInfoResponse = await fetchUserInfo(
      discovered,
      tokenSet.access_token!,
      claims.orcid
    )
    logger.info('ORCID user info:', userinfo)

    let user = await User.findOne({ 'oauth.provider': 'orcid', 'oauth.id': userinfo.sub })

    if (!user) {
      user = await User.create({
        email: userinfo.email,
        username: userinfo.email?.split('@')[0] || 'orciduser',
        roles: ['User'],
        oauth: [{ provider: 'orcid', id: userinfo.sub }],
        refreshTokens: []
      })
    }

    res.clearCookie('orcid_oauth_state')
    res.clearCookie('orcid_oauth_nonce')

    const accessToken = await issueTokensAndSetCookie(user, res)
    res.redirect(`/welcome?token=${accessToken}`)
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
