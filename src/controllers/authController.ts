import { logger } from '../middleware/loggers.js'
import { User, IUser } from '@bl1231/bilbomd-mongodb-schema'
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

const otp = async (req: Request, res: Response) => {
  try {
    const { otp: code } = req.body

    if (!code) res.status(400).json({ message: 'OTP required.' })

    const user: IUser | null = await User.findOne({ 'otp.code': code })

    if (user) {
      logger.debug('Found User: %s', user)
      // logger.info({ level: 'info', message: 'hello' })
      logger.info(`OTP login for user: ${user.username} email: ${user.email}`)

      // Check if OTP has expired
      const currentTimestamp = Date.now()
      if (user.otp?.expiresAt && user.otp.expiresAt.getTime() < currentTimestamp) {
        logger.warn('OTP has expired')
        res.status(401).json({ error: 'OTP has expired' })
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
      res.json({ accessTokenData })
    } else {
      logger.warn('Invalid OTP')
      res.status(401).json({ message: 'Invalid OTP' })
    }
  } catch (error) {
    logger.error('Error occurred while querying user: %s', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

const refresh = async (req: Request, res: Response) => {
  const cookies = req.cookies
  // logger.info(`refresh got cookies: ${JSON.stringify(cookies)}`)

  if (!cookies?.jwt) {
    res.status(401).json({ message: 'Unauthorized - no token' })
    return
  }

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
        res.status(401).json({ message: 'Unauthorized' })
        return
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
      // console.log(accessToken)
      res.json({ accessToken })
    } catch (error) {
      // Handle errors here
      console.error(error)
      res.status(500).json({ message: 'Internal Server Error' })
    }
  } catch (error) {
    logger.error(`Error occurred while verifying token: ${error}`)
    res.status(403).json({ message: 'Forbidden' })
  }
}

const logout = (req: Request, res: Response) => {
  const cookies = req.cookies
  if (!cookies?.jwt) res.sendStatus(204) //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'none', secure: true })
  res.json({ message: 'Cookie cleared' })
}

export { otp, refresh, logout }
