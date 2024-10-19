import { logger } from '../middleware/loggers.js'
import { config } from '../config/config.js'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { v4 as uuid } from 'uuid'
import { Request, Response } from 'express'
import { sendVerificationEmail } from '../config/nodemailerConfig.js'
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const bilboMdUrl: string = process.env.BILBOMD_URL ?? ''

const handleNewUser = async (req: Request, res: Response) => {
  const { user, email } = req.body
  logger.info(`handleNewUser ${user}, ${email}`)
  // confirm we have required data
  if (!user || !email)
    res.status(400).json({
      message: 'Username and email are required.'
    })

  // check for duplicate username in the db
  const duplicateUser = await User.findOne({ username: user })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec()
  if (duplicateUser) res.status(409).json({ message: 'Duplicate username' })

  // check for duplicate emails in the db
  const duplicateEmail = await User.findOne({
    $or: [{ email: email }, { previousEmails: { $in: [email] } }]
  })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();
  
  if (duplicateEmail) {
    res.status(409).json({
      success: false,
      message: 'The email is already in use in one of the accounts'
    });
    return;
  }

  try {
    //create a unique confirmation code
    let code = ''
    for (let i = 0; i < 36; i++) {
      code += characters[Math.floor(Math.random() * characters.length)]
    }
    logger.info(`New user ${user} confirmationCode: ${code}`)

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
    logger.info(`Created ${newUser.username}`)

    if (config.sendEmailNotifications) {
      sendVerificationEmail(email, bilboMdUrl, code)
    }

    res.status(201).json({ success: `New user ${user} created!`, code: code })
  } catch (error) {
    logger.error(`error creating new user: ${error}`)
    res.status(400).json({ message: 'Invalid user data received' })
  }
}

export { handleNewUser }
