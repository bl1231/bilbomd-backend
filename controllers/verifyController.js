const User = require('../model/User')
const { sendVerificationEmail } = require('../config/nodemailerConfig')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const { BILBOMD_URL } = process.env

const verifyNewUser = async (req, res) => {
  if (!req?.body?.code) {
    return res.status(400).json({ message: 'confirmation code required.' })
  }
  console.log('verification code:', req.body.code)
  const user = await User.findOne({ confirmationCode: req.body.code }).exec()
  console.log('verification code belongs to user:', user?.username, user?.email)

  if (!user) {
    return res.status(204).json({ message: `Unable to verify ${req.body.code}.` })
  }

  // console.log('unverified user:', user)

  // Set status to "Active" and delete the conformationCode
  if (req.body?.code) {
    user.status = 'Active'
    user.confirmationCode = undefined
    const result = await user.save()
    //console.log('save verified user to MongoDB:', result)
  }
  res.json({ message: 'verified' })
}
const resendVerificationCode = async (req, res) => {
  const { email } = req.body
  console.log('request to resendVerificationCode for:', email)

  // confirm we have required data
  if (!email)
    return res.status(400).json({
      message: 'email required.'
    })

  // check for user in the db
  const foundUser = await User.findOne({ email: email }).exec()

  if (!foundUser) return res.status(401).json({ message: 'no user with that email' })
  // console.log('resendVerificationCode found user:', foundUser)
  try {
    //create a new confirmation code
    let confirmationCode = ''
    for (let i = 0; i < 36; i++) {
      confirmationCode += characters[Math.floor(Math.random() * characters.length)]
    }

    // add verification code to the Users MongoDB entry
    foundUser.confirmationCode = confirmationCode
    const result = await foundUser.save()
    console.log(
      'updated user: ',
      result.username,
      'email: ',
      result.email,
      'code: ',
      result.confirmationCode
    )

    //send Verification email
    sendVerificationEmail(email, BILBOMD_URL, confirmationCode)

    res.status(201).json({ message: 'ok' })
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: 'invalid user data received' })
  }
}
module.exports = { verifyNewUser, resendVerificationCode }
