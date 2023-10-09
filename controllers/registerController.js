const { logger } = require('../middleware/loggers')
const User = require('../model/User')
const { v4: uuid } = require('uuid')
const { sendVerificationEmail } = require('../config/nodemailerConfig')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const { BILBOMD_URL } = process.env

/**
 * @swagger
 * /register/new-user:
 *   post:
 *     summary: Create a New User
 *     description: Creates a new user with the provided username and email.
 *     tags:
 *       - User Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: The username of the new user.
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email address of the new user.
 *             required:
 *               - user
 *               - email
 *     responses:
 *       201:
 *         description: User created successfully.
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
 *                   description: Confirmation code for email verification.
 *       400:
 *         description: Invalid user data received.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       409:
 *         description: Conflict. Duplicate username or email found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const handleNewUser = async (req, res) => {
  // logger.info('handleNewUser', req.body)
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
  if (duplicateUser) return res.status(409).json({ message: 'Duplicate username' }) //Conflict

  // check for duplicate emails in the db
  const duplicate = await User.findOne({ email: email })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec()
  if (duplicate) return res.status(409).json({ message: 'Duplicate email' }) //Conflict

  try {
    //create a unique confirmation code
    let code = ''
    for (let i = 0; i < 36; i++) {
      code += characters[Math.floor(Math.random() * characters.length)]
    }
    logger.info('made new confirmationCode: %s', code)

    //  120000 ms = 2minutes
    // 3600000 ms = 1hour
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
    logger.info(newUser)

    //send Verification email
    sendVerificationEmail(email, BILBOMD_URL, code)

    res.status(201).json({ success: `New user ${user} created!`, code: code })
  } catch (err) {
    logger.error('error %s', err)
    res.status(400).json({ message: 'Invalid user data received' })
  }
}

module.exports = handleNewUser
