import { logger } from '../middleware/loggers'
import { config } from '../config/config'
import crypto from 'crypto'
// import { User } from '../model/User'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { sendMagickLinkEmail } from '../config/nodemailerConfig'
const bilboMdUrl: string = process.env.BILBOMD_URL ?? ''

/**
 * @openapi
 * /magicklink:
 *   post:
 *     summary: Generate Magic Link
 *     description: Generates a one-time password (OTP) for user authentication based on the provided email address.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       description: Email address of the user to generate the magic link for.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address associated with the user's account.
 *     responses:
 *       201:
 *         description: OTP created and magic link (if applicable) sent to the user's email address.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request due to missing email field.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating that the email field is required.
 *       401:
 *         description: Unauthorized request because no account exists with the provided email address.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating no account found with that email.
 *       403:
 *         description: Forbidden action due to the user's account being in a pending state or deactivated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the account status.
 *       500:
 *         description: Internal server error occurred during the magic link generation process.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: General error message for server-side errors.
 */
const generateMagickLink = async (req: Request, res: Response) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'email is required' })
  }

  const foundUser = await User.findOne({ email }).exec()

  if (!foundUser) {
    return res.status(401).json({ message: 'no account with that email' })
  }

  if (foundUser.status === 'Pending') {
    return res.status(403).json({ message: 'Pending', email })
  }

  if (!foundUser.active) {
    return res.status(403).json({ message: 'account deactivated' })
  }

  try {
    const passcode = crypto.randomBytes(17).toString('hex')

    const otp = { code: passcode, expiresAt: new Date(Date.now() + 3600000) }
    foundUser.otp = otp
    await foundUser.save()

    logger.info(`Magicklink requested by ${foundUser.email} send OTP: ${passcode}`)

    if (config.sendEmailNotifications) {
      sendMagickLinkEmail(email, bilboMdUrl, passcode)
    }

    res.status(201).json({ success: `OTP created for ${email}` })
  } catch (error) {
    logger.error(`Magicklink error: ${error}`)
    res.status(500).json({ message: error })
  }
}

export { generateMagickLink }
