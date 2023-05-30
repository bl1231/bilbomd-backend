const { logger } = require('../middleware/loggers')
const User = require('../model/User')
const jwt = require('jsonwebtoken')

// @desc OTP
// @route POST /auth/otp
// @access Public
const otp = async (req, res) => {
  try {
    const { otp: code } = req.body

    if (!code) return res.status(400).json({ message: 'OTP required.' })

    const user = await User.findOne({ 'otp.code': code })

    if (user) {
      logger.debug('Found User: %s', user)
      // logger.info({ level: 'info', message: 'hello' })
      logger.info('OTP login for user: %s email: %s', user.username, user.email)

      // Check if OTP has expired
      const currentTimestamp = Date.now()
      if (user.otp?.expiresAt < currentTimestamp) {
        logger.warn('OTP has expired')
        return res.status(401).json({ error: 'OTP has expired' })
      }

      // accessToken - memory only, short lived, allows access to protected routes
      const accessToken = jwt.sign(
        {
          UserInfo: {
            username: user.username,
            roles: user.roles,
            email: user.email
          }
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      )

      // refreshToken - http only, secure, allows for refresh of expired accessTokens
      const refreshToken = jwt.sign(
        {
          username: user.username,
          roles: user.roles,
          email: user.email
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      )

      // Creates Secure Cookie with our refreshToken
      // logger.info('about to set cookie')
      res.cookie('jwt', refreshToken, {
        httpOnly: true, //accessible only by web server
        sameSite: 'None', //cross-site cookie
        secure: true, //https
        maxAge: 7 * 24 * 60 * 60 * 1000 //cookie expiry: set to match rT
      })
      // logger.info('about to remove OTP ')
      user.otp = undefined
      await user.save()

      // Send the accessToken back to client
      res.json({ accessToken })
    } else {
      logger.warn('Invalid OTP')
      res.status(401).json({ message: 'Invalid OTP' })
    }
  } catch (error) {
    logger.error('Error occurred while querying user: %s', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies
  logger.info('refresh got cookies: %s', cookies)

  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized' })

  const refreshToken = cookies.jwt

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden' })

    const foundUser = await User.findOne({ email: decoded.email }).exec()

    if (!foundUser) return res.status(401).json({ message: 'Unauthorized' })

    const accessToken = jwt.sign(
      {
        UserInfo: {
          username: foundUser.username,
          roles: foundUser.roles,
          email: foundUser.email
        }
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    )

    res.json({ accessToken })
  })
}

// @desc Logout
// @route POST /auth/logout
// @access Public - just to clear cookie if exists
const logout = (req, res) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(204) //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })
  res.json({ message: 'Cookie cleared' })
}

module.exports = { otp, refresh, logout }
