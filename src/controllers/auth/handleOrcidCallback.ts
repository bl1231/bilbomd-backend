import { Request, Response } from 'express'
import {
  authorizationCodeGrant,
  TokenEndpointResponse,
  UserInfoResponse,
  fetchUserInfo
} from 'openid-client'
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
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`)
    const tokenSet: TokenEndpointResponse = await authorizationCodeGrant(
      discovered,
      currentUrl,
      { expectedState: state }
    )

    logger.debug('Received tokenSet:', tokenSet)

    const claims = tokenSet.claims
    if (
      !claims ||
      Array.isArray(claims) ||
      typeof claims !== 'object' ||
      typeof (claims as { sub?: unknown }).sub !== 'string'
    ) {
      logger.error('Missing or invalid sub in token claims:', claims)
      res.status(400).send('Invalid ID token from ORCID')
      return
    }

    const userinfo: UserInfoResponse = await fetchUserInfo(
      discovered,
      tokenSet.access_token!,
      (claims as { sub: string }).sub
    )
    logger.debug('ORCID user info:', userinfo)

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
    if (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      typeof (err as { response?: { text?: () => Promise<string> } }).response?.text ===
        'function'
    ) {
      const errorText = await (
        err as { response: { text: () => Promise<string> } }
      ).response.text()
      logger.error('ORCID token exchange error body:', errorText)
    }
    logger.error('ORCID callback error:', err)
    res.status(500).send('Authentication failed')
  }
}
