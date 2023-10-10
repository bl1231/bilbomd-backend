const { logger } = require('../middleware/loggers')
const User = require('../model/User')
const jwt = require('jsonwebtoken')

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
const logout = (req, res) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(204) //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })
  res.json({ message: 'Cookie cleared' })
}

module.exports = { otp, refresh, logout }
