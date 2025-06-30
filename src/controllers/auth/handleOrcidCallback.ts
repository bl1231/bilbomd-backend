import { Request, Response } from 'express'
import {
  authorizationCodeGrant,
  fetchUserInfo,
  TokenEndpointResponse,
  UserInfoResponse
} from 'openid-client'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { issueTokensAndSetCookie } from './authTokens.js'
import { discovered } from './orcidClientConfig.js'
import { logger } from '../../middleware/loggers.js'

interface GetCurrentUrl {
  (...args: unknown[]): URL
}

export async function handleOrcidCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  const storedState = req.cookies.orcid_oauth_state

  if (!code || !state || state !== storedState) {
    res.status(400).send('Invalid or missing authorization parameters')
    return
  }

  try {
    let getCurrentUrl!: GetCurrentUrl

    const tokenSet: TokenEndpointResponse = await authorizationCodeGrant(
      discovered,
      getCurrentUrl(),
      { expectedState: state }
    )

    // Fetch user info from ORCID using the access token
    const userinfo: UserInfoResponse = await fetchUserInfo(
      discovered,
      tokenSet.access_token!,
      'ORCID'
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
  } catch (err) {
    console.error('ORCID callback error:', err)
    res.status(500).send('Authentication failed')
  }
}
