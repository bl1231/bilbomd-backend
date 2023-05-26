const User = require('../model/User')
const jwt = require('jsonwebtoken')

// @desc OTP
// @route POST /auth/otp
// @access Public
const otp = async (req, res) => {
  const { otp: code } = req.body

  if (!code) return res.status(400).json({ message: 'OTP required.' })

  let foundUser
  let accessToken

  await User.findOne({ 'otp.code': code })
    .then((user) => {
      if (user) {
        console.log('User found:', user)
        foundUser = user // so we can access outside of then/catch

        // accessToken - memory only, short lived, allows access to protected routes
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

        // refreshToken - http only, secure, allows for refresh of expired accessTokens
        const refreshToken = jwt.sign(
          {
            username: foundUser.username,
            roles: foundUser.roles,
            email: foundUser.email
          },
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: '7d' }
        )

        // Creates Secure Cookie with our refreshToken
        res.cookie('jwt', refreshToken, {
          httpOnly: true, //accessible only by web server
          sameSite: 'None', //cross-site cookie
          secure: true, //https
          maxAge: 7 * 24 * 60 * 60 * 1000 //cookie expiry: set to match rT
        })
        console.log('about to remove OTP ')
        foundUser.otp = undefined
        const result = foundUser.save()
        console.log('----------------------------------------------')
        console.log('handleOTP', result)
        console.log('----------------------------------------------')

        // Send the accessToken back to client
        res.json({ accessToken })
      } else {
        console.log('No user with that OTP')
        res.status(401).json({ message: 'Invalid OTP' })
      }
    })
    .catch((error) => {
      console.error('Error occurred while querying user:', error)
      res.status(500).json({ message: 'Internal server error' })
    })
}

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies
  console.log('refresh got cookies:', cookies)

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
