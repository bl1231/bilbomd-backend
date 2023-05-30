const { logger } = require('../middleware/loggers')
const User = require('../model/User')
const { sendVerificationEmail } = require('../config/nodemailerConfig')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const { BILBOMD_URL } = process.env

const verifyNewUser = async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      return res.status(400).json({ message: 'Confirmation code required.' })
    }

    logger.info('Received verification code: %s', code)
    const user = await User.findOne({ 'confirmationCode.code': code })

    if (!user) {
      logger.warn('Unable to verify %s', code)
      return res.status(400).json({ message: `Unable to verify ${code}.` })
    }

    logger.info('Verification code belongs to user: %s %s', user.username, user.email)

    // Set status to "Active" and delete the confirmationCode
    user.status = 'Active'
    user.confirmationCode = undefined
    await user.save()
    logger.info('%s verified!', user.email)
    res.json({ message: 'Verified' })
  } catch (error) {
    logger.error('Error occurred during user verification: %s', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body
    logger.info('Request to resendVerificationCode for: %s', email)

    // Confirm we have required data
    if (!email) {
      return res.status(400).json({ message: 'Email required.' })
    }

    // Check for user in the db
    const foundUser = await User.findOne({ email })

    if (!foundUser) {
      return res.status(401).json({ message: 'No user with that email.' })
    }

    // Generate a new confirmation code
    let code = ''
    for (let i = 0; i < 36; i++) {
      code += characters[Math.floor(Math.random() * characters.length)]
    }

    const confirmationCode = { code, expiresAt: new Date(Date.now() + 3600000) }

    // Add verification code to the user's MongoDB entry
    foundUser.confirmationCode = confirmationCode
    await foundUser.save()

    logger.info(
      'Updated %s email: %s confirmationCode: %s',
      foundUser.username,
      foundUser.email,
      foundUser.confirmationCode.code
    )

    // Send verification email
    sendVerificationEmail(email, BILBOMD_URL, code)

    res.status(201).json({ message: 'OK' })
  } catch (error) {
    logger.error('Error occurred during resendVerificationCode: %s', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = { verifyNewUser, resendVerificationCode }
