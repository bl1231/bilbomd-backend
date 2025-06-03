import { Request, Response } from 'express'
import { authorizationCodeGrant, fetchUserInfo } from 'openid-client'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { issueTokensAndSetCookie } from './authTokens'
import { discovered, clientConfig } from './orcidClientConfig'

export async function handleOrcidCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  const storedState = req.cookies.orcid_oauth_state

  if (!code || !state || state !== storedState) {
    res.status(400).send('Invalid or missing authorization parameters')
    return
  }

  try {
    const tokenSet = await authorizationCodeGrant(
      discovered,
      {
        code,
        redirect_uri: clientConfig.redirect_uri
      },
      {
        client_id: clientConfig.client_id,
        client_secret: clientConfig.client_secret
      }
    )

    const userinfoEndpoint = discovered.server

    const userinfo = await fetchUserInfo(
      userinfoEndpoint,
      tokenSet.access_token!,
      tokenSet.claims().sub
    )

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
