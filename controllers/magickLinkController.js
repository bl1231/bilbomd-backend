const User = require('../model/User')
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const { sendMagickLinkEmail } = require('../config/nodemailerConfig')

const { BILBOMD_URL } = process.env
const generateMagickLink = async (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ messge: 'email is required' })
  }

  const foundUser = await User.findOne({ email: email }).exec()
  if (!foundUser) return res.status(401).json({ message: 'no account with that email' }) // unauthorized.
  // Refuse to generate OTP if user is "Pending"
  if (foundUser.status == 'Pending')
    return res.status(403).json({ message: 'Pending', email: email })
  if (foundUser.active == false)
    return res.status(403).json({ message: 'account deactivated' })
  try {
    // generate a 34 character One Time Password (OTP)
    let passcode = ''
    for (let i = 0; i < 34; i++) {
      passcode += characters[Math.floor(Math.random() * characters.length)]
    }

    const otp = { code: passcode, expiresAt: new Date(Date.now() + 3600000) }
    // add OTP to the Users MongoDB entry
    foundUser.otp = otp
    const result = await foundUser.save()
    console.log(result)

    //send MagickLink email
    sendMagickLinkEmail(email, BILBOMD_URL, passcode)

    res.status(201).json({ success: `OTP created for ${email}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { generateMagickLink }
