const User = require('../model/User')
const { v4: uuid } = require('uuid')
//const sendConfirmationEmail = require('../config/nodemailerConfig');
const { sendVerificationEmail } = require('../config/nodemailerConfig')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

// const conformationURL = 'http://localhost:3001'

const { BILBOMD_URL } = process.env

const handleNewUser = async (req, res) => {
  console.log('handleNewUser', req.body)
  const { user, email } = req.body

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
    let confirmationCode = ''
    for (let i = 0; i < 36; i++) {
      confirmationCode += characters[Math.floor(Math.random() * characters.length)]
    }

    // unique UUID for each user
    const UUID = uuid()

    //create and store the new user
    const newUser = await User.create({
      username: user,
      email: email,
      roles: ['User'],
      confirmationCode: confirmationCode,
      UUID: UUID,
      createdAt: Date()
    })
    console.log(newUser)

    //send Verification email
    sendVerificationEmail(email, BILBOMD_URL, confirmationCode)

    res.status(201).json({ success: `New user ${user} created!` })
  } catch (err) {
    res.status(400).json({ message: 'Invalid user data received' })
  }
}

module.exports = { handleNewUser }
