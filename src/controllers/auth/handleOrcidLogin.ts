import { Request, Response } from 'express'
import { clientConfig, discovered } from './orcidClientConfig'
import { buildAuthorizationUrl, randomState, randomNonce } from 'openid-client'

export async function handleOrcidLogin(req: Request, res: Response) {
  const state = randomState()
  const nonce = randomNonce()

  // Store them in a secure cookie or session
  res.cookie('orcid_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  })
  res.cookie('orcid_oauth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  })
  const url = buildAuthorizationUrl(discovered, {
    client_id: clientConfig.client_id,
    redirect_uri: clientConfig.redirect_uri,
    response_type: clientConfig.response_types[0],
    scope: clientConfig.scope,
    state,
    nonce
  })

  res.redirect(url.toString())
}
