import { logger } from '../middleware/loggers'
import crypto from 'crypto'
import { User } from '../model/User'
import { Request, Response } from 'express'
import { sendMagickLinkEmail } from '../config/nodemailerConfig'
const bilboMdUrl: string = process.env.BILBOMD_URL ?? ''

/**
 * @openapi
 * /magicklink:
 *   post:
 *     summary: Generate a MagickLink for user authentication.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *     responses:
 *       201:
 *         description: MagickLink and OTP created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   description: A success message.
 *                 otp:
 *                   type: string
 *                   description: The generated OTP (One-Time Password).
 *       400:
 *         description: Bad request. Missing email.
 *       401:
 *         description: Unauthorized. No account found with the provided email.
 *       403:
 *         description: Forbidden. Account is pending or deactivated.
 *       500:
 *         description: Internal server error.
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

    const message = 'magicklink requested by %s send OTP: %s'
    logger.info(message, foundUser.email, passcode)

    // Send MagickLink email
    sendMagickLinkEmail(email, bilboMdUrl, passcode)

    res.status(201).json({ success: `OTP created for ${email}`, otp: passcode })
  } catch (error) {
    logger.error(`magicklink error: ${error}`)
    res.status(500).json({ message: error })
  }
}

export { generateMagickLink }
