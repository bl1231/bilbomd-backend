import { logger } from '../middleware/loggers'
import { User, IUser } from '../model/User'
// import { Schema } from 'mongoose'
import jwt from 'jsonwebtoken'
import { Request, Response } from 'express'

const accessTokenSecret: string = process.env.ACCESS_TOKEN_SECRET ?? ''
const refreshTokenSecret: string = process.env.REFRESH_TOKEN_SECRET ?? ''

interface JwtPayload {
  UserInfo: BilboMDJwtPayload
}

interface BilboMDJwtPayload {
  username: string
  roles: string[]
  email: string
}

interface AccessToken {
  accessToken: string
}

interface RefreshToken {
  refreshToken: string
}

/**
 * @openapi
 * /auth/otp:
 *   post:
 *     summary: Authenticate user with OTP
 *     description: Authenticate a user by providing a one-time password (OTP).
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp:
 *                 type: string
 *                 description: The one-time password provided by the user.
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Authentication successful. Returns an access token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: An access token for the authenticated user.
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Bad Request. Missing or invalid OTP.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *                   example: OTP required.
 *       401:
 *         description: Unauthorized. Invalid OTP or OTP has expired.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message.
 *                   example: OTP has expired.
 *       500:
 *         description: Internal Server Error. An error occurred while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *                   example: Internal server error.
 */
const otp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { otp: code } = req.body

    if (!code) return res.status(400).json({ message: 'OTP required.' })

    const user: IUser | null = await User.findOne({ 'otp.code': code })

    if (user) {
      logger.debug('Found User: %s', user)
      // logger.info({ level: 'info', message: 'hello' })
      logger.info(`OTP login for user: ${user.username} email: ${user.email}`)

      // Check if OTP has expired
      const currentTimestamp = Date.now()
      if (user.otp?.expiresAt && user.otp.expiresAt.getTime() < currentTimestamp) {
        logger.warn('OTP has expired')
        return res.status(401).json({ error: 'OTP has expired' })
      }

      // Generating an access token
      const accessTokenPayload: JwtPayload = {
        UserInfo: {
          username: user.username,
          roles: user.roles,
          email: user.email
        }
      }

      const accessToken: string = jwt.sign(accessTokenPayload, accessTokenSecret, {
        expiresIn: '15m'
      })

      const accessTokenData: AccessToken = {
        accessToken
      }

      const refreshTokenPayload: RefreshToken = {
        refreshToken: jwt.sign(
          {
            username: user.username,
            roles: user.roles,
            email: user.email
          },
          refreshTokenSecret,
          { expiresIn: '7d' }
        )
      }

      // Creates Secure Cookie with our refreshToken
      // logger.info('about to set cookie')
      const isProduction = process.env.NODE_ENV === 'production'
      res.cookie('jwt', refreshTokenPayload.refreshToken, {
        httpOnly: true, // Accessible only by web server
        sameSite: isProduction ? 'none' : 'lax', // Use 'none' for cross-site cookie in prod, 'lax' in dev
        secure: isProduction, // Use HTTPS for prod, allow HTTP for dev
        maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiry: set to match refreshToken
      })
      // logger.info('about to remove OTP ')
      user.otp = null
      await user.save()

      // Send the accessToken back to client
      // logger.info(`Sending jwt: ${JSON.stringify(accessTokenData)}`)
      return res.json({ accessTokenData })
    } else {
      logger.warn('Invalid OTP')
      return res.status(401).json({ message: 'Invalid OTP' })
    }
  } catch (error) {
    logger.error('Error occurred while querying user: %s', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * @openapi
 * /auth/refresh:
 *   get:
 *     summary: Refresh Access Token
 *     description: Refreshes the access token using a valid refresh token.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: cookie
 *         name: jwt
 *         required: true
 *         schema:
 *           type: string
 *         description: The refresh token received in a cookie.
 *     responses:
 *       '200':
 *         description: Successful refresh.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: The new access token.
 *       '401':
 *         description: Unauthorized. Invalid or missing refresh token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       '403':
 *         description: Forbidden. Refresh token is invalid or expired.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const refresh = async (req: Request, res: Response) => {
  const cookies = req.cookies
  // logger.info(`refresh got cookies: ${JSON.stringify(cookies)}`)

  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized - no token' })

  const refreshToken = cookies.jwt
  // logger.info(`refresh got jwt: ${refreshToken}`)

  try {
    const decoded = jwt.verify(refreshToken, refreshTokenSecret, {
      algorithms: ['HS256']
    }) as BilboMDJwtPayload
    // console.log('decoded --->', decoded)

    try {
      const foundUser = await User.findOne({ email: decoded.email }).exec()
      // console.log('foundUser --->', foundUser)
      if (!foundUser) {
        return res.status(401).json({ message: 'Unauthorized' })
      }

      const accessToken = jwt.sign(
        {
          UserInfo: {
            username: foundUser.username,
            roles: foundUser.roles,
            email: foundUser.email
          }
        },
        accessTokenSecret,
        { expiresIn: '15m' }
      )

      res.json({ accessToken })
    } catch (error) {
      // Handle errors here
      console.error(error)
      res.status(500).json({ message: 'Internal Server Error' })
    }
  } catch (error) {
    res.status(403).json({ message: 'Forbidden' })
  }
}

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout and Clear JWT Cookie
 *     description: Logs out the user by clearing the JWT cookie.
 *     tags:
 *       - Authentication
 *     responses:
 *       204:
 *         description: JWT cookie cleared successfully.
 *       200:
 *         description: JWT cookie cleared successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 */
const logout = (req: Request, res: Response) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(204) //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'none', secure: true })
  res.json({ message: 'Cookie cleared' })
}

export { otp, refresh, logout }
