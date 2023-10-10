const { logger } = require('../middleware/loggers')
const User = require('../model/User')
const { sendVerificationEmail } = require('../config/nodemailerConfig')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const { BILBOMD_URL } = process.env

/**
 * @openapi
 * /verify:
 *   post:
 *     summary: Verify New User
 *     description: Verify a new user's registration using a confirmation code.
 *     tags:
 *       - User Management
 *     requestBody:
 *       description: The confirmation code to verify the new user.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: The confirmation code to verify the new user.
 *     responses:
 *       200:
 *         description: User verified successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
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

/**
 * @openapi
 * /resend-verification:
 *   post:
 *     summary: Resend Verification Code
 *     description: Resend a verification code to a user's email for account confirmation.
 *     tags:
 *       - User Management
 *     requestBody:
 *       description: The user's email to resend the verification code.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address for resending the verification code.
 *     responses:
 *       201:
 *         description: Verification code resent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       401:
 *         description: Unauthorized. No user with the provided email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
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
