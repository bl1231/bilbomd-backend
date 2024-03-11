// eslint-disable-next-line no-unused-vars
import { Express, Request, Response } from 'express'
import axios from 'axios'

const baseURL = 'https://api.nersc.gov/api/v1.2'

const getStatus = async (req: Request, res: Response) => {
  try {
    // Assuming req.sfApiToken is the OAuth2 token added by your authentication middleware
    const sfApiToken = req.sfApiToken
    if (!sfApiToken) {
      // If the token isn't present, respond with an unauthorized status
      return res.status(401).json({ error: 'Unauthorized: No SF API token provided.' })
    }

    const response = await axios.get(`${baseURL}/status`, {
      headers: {
        Authorization: `Bearer ${sfApiToken}`
      }
    })

    // Send back the API response
    res.json(response.data)
  } catch (error) {
    console.error('Error fetching SF API status:', error)
    // Respond with a 500 internal server error status
    // Adjust the error handling as appropriate for your use case
    res.status(500).json({ error: 'Failed to fetch status from SF API.' })
  }
}

const getUser = async (req: Request, res: Response) => {
  const username = 'sclassen'
  try {
    const sfApiToken = req.sfApiToken
    if (!sfApiToken) {
      return res.status(401).json({ error: 'Unauthorized: No SF API token provided.' })
    }

    const response = await axios.get(`${baseURL}/account`, {
      headers: {
        Authorization: `Bearer ${sfApiToken}`
      },
      params: {
        username: username
      }
    })

    // Send back the API response
    res.json(response.data)
  } catch (error) {
    console.error('Error fetching SF API status:', error)
    // Respond with a 500 internal server error status
    // Adjust the error handling as appropriate for your use case
    res.status(500).json({ error: 'Failed to fetch status from SF API.' })
  }
}

export { getStatus, getUser }
