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

    console.log('Verification code:', code)
    const user = await User.findOne({ 'confirmationCode.code': code })

    if (!user) {
      return res.status(400).json({ message: `Unable to verify ${code}.` })
    }

    console.log('Verification code belongs to user:', user.username, user.email)

    // Set status to "Active" and delete the confirmationCode
    user.status = 'Active'
    user.confirmationCode = undefined
    await user.save()

    res.json({ message: 'Verified' })
  } catch (error) {
    console.error('Error occurred during user verification:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body
    console.log('Request to resendVerificationCode for:', email)

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

    console.log(
      'Updated user:',
      foundUser.username,
      'Email:',
      foundUser.email,
      'Code:',
      foundUser.confirmationCode
    )

    // Send verification email
    sendVerificationEmail(email, BILBOMD_URL, code)

    res.status(201).json({ message: 'OK' })
  } catch (error) {
    console.error('Error occurred during resendVerificationCode:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = { verifyNewUser, resendVerificationCode }
