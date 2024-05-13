import { logger } from '../middleware/loggers'
import { config } from '../config/config'
// import { User } from '../model/User'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { v4 as uuid } from 'uuid'
import { Request, Response } from 'express'
import { sendVerificationEmail } from '../config/nodemailerConfig'
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const bilboMdUrl: string = process.env.BILBOMD_URL ?? ''

/**
 * @openapi
 * /register:
 *   post:
 *     summary: Create a New User
 *     description: Registers a new user with username and email. Returns a conflict error if the username or email already exists.
 *     tags:
 *       - User Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - email
 *             properties:
 *               user:
 *                 type: string
 *                 description: The username for the new user.
 *               email:
 *                 type: string
 *                 description: The email address for the new user.
 *     responses:
 *       201:
 *         description: Successfully created the new user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   description: Success message.
 *                 code:
 *                   type: string
 *                   description: Confirmation code for the user.
 *       400:
 *         description: Bad request due to missing username or email, or invalid user data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message explaining the reason for the bad request.
 *       409:
 *         description: Conflict due to duplicate username or email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating a duplicate username or email.
 */
const handleNewUser = async (req: Request, res: Response) => {
  const { user, email } = req.body
  logger.info('handleNewUser: %s %s', user, email)
  // confirm we have required data
  if (!user || !email)
    return res.status(400).json({
      message: 'Username and email are required.'
    })

  // check for duplicate username in the db
  const duplicateUser = await User.findOne({ username: user })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec()
  if (duplicateUser) return res.status(409).json({ message: 'Duplicate username' })

  // check for duplicate emails in the db
  const duplicate = await User.findOne({ email: email })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec()
  if (duplicate) return res.status(409).json({ message: 'Duplicate email' })

  try {
    //create a unique confirmation code
    let code = ''
    for (let i = 0; i < 36; i++) {
      code += characters[Math.floor(Math.random() * characters.length)]
    }
    logger.info('made new confirmationCode: %s', code)

    //  120000 ms = 2 min
    // 3600000 ms = 1 hour
    const confirmationCode = { code: code, expiresAt: new Date(Date.now() + 3600000) }

    // unique UUID for each user
    const UUID = uuid()

    // create and store the new user
    const newUser = await User.create({
      username: user,
      email: email,
      roles: ['User'],
      confirmationCode: confirmationCode,
      UUID: UUID,
      createdAt: Date()
    })
    logger.info(newUser.username)

    if (config.sendEmailNotifications) {
      sendVerificationEmail(email, bilboMdUrl, code)
    }

    res.status(201).json({ success: `New user ${user} created!`, code: code })
  } catch (err) {
    logger.error('error %s', err)
    res.status(400).json({ message: 'Invalid user data received' })
  }
}

export { handleNewUser }
