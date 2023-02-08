const User = require('../model/User')

const verifyNewUser = async (req, res) => {
  if (!req?.body?.code) {
    return res.status(400).json({ message: 'confirmation code required.' })
  }
  console.log('verification code:', req.body.code)
  const user = await User.findOne({ confirmationCode: req.body.code }).exec()
  if (!user) {
    return res.status(204).json({ message: `Unable to verify ${req.body.code}.` })
  }
  console.log('unverified user:', user)

  if (req.body?.code) {
    user.status = 'Active'
    user.confirmationCode = undefined
    const result = await user.save()
    console.log('save verified user to MongoDB:', result)
    res.json(result)
  }
}
module.exports = { verifyNewUser }
