import axios from 'axios'

const tokenUrl = 'https://oidc.nersc.gov/c2id/token'
let accessToken: string | null = null
let fetchTokenTimeout: ReturnType<typeof setTimeout> | null = null

interface TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  // Include other fields from the token response if necessary
}

async function fetchAndStoreToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')

  try {
    const { data } = await axios.post<TokenResponse>(tokenUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: clientId, password: clientSecret }
    })

    accessToken = data.access_token
    // Refresh token a bit before it expires (e.g., 1 minute before)
    const expiresInMs = (data.expires_in - 60) * 1000
    if (fetchTokenTimeout) {
      clearTimeout(fetchTokenTimeout)
    }
    fetchTokenTimeout = setTimeout(
      () => fetchAndStoreToken(clientId, clientSecret),
      expiresInMs
    )

    return accessToken
  } catch (error) {
    console.error('Error fetching token:', error)
    throw error
  }
}

function getToken(): string | null {
  return accessToken
}

export { fetchAndStoreToken, getToken }
