const User = require('../model/User')

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
module.exports = { verifyNewUser }
