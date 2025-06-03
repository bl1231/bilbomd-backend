import { discovery } from 'openid-client'

const ORCID_ISSUER = new URL('https://orcid.org')

export const clientConfig = {
  client_id: process.env.ORCID_CLIENT_ID!,
  client_secret: process.env.ORCID_CLIENT_SECRET!,
  redirect_uri: process.env.ORCID_REDIRECT_URI!,
  response_types: ['code'],
  scope: 'openid email profile'
}

export let discovered: Awaited<ReturnType<typeof discovery>>

export async function initOrcidClient() {
  discovered = await discovery(
    ORCID_ISSUER,
    clientConfig.client_id,
    clientConfig.client_secret
  )
}
