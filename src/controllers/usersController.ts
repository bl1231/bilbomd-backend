import { User } from '@bl1231/bilbomd-mongodb-schema'
import { Job } from '@bl1231/bilbomd-mongodb-schema'
import { logger } from '../middleware/loggers.js'
import { Request, Response } from 'express'
import { sendOtpEmail } from './../config/nodemailerConfig.js'
import crypto from 'crypto'

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Helper function to validate username format
const isValidUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_]+$/
  return usernameRegex.test(username)
}

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean()
    res.json({ success: true, data: users })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const updateUser = async (req: Request, res: Response) => {
  const { id, username, roles, active, email } = req.body

  // Validate inputs
  if (!id) {
    return res.status(400).json({ success: false, message: 'User ID is required' })
  }
  if (!username || !isValidUsername(username)) {
    return res.status(400).json({ success: false, message: 'Invalid username format' })
  }
  if (!Array.isArray(roles) || !roles.length) {
    return res.status(400).json({ success: false, message: 'Roles are required' })
  }
  if (typeof active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Active status is required' })
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' })
  }

  try {
    const user = await User.findById(id).exec()

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const duplicate = await User.findOne({ username })
      .collation({ locale: 'en', strength: 2 })
      .lean()
      .exec()

    if (duplicate && duplicate?._id.toString() !== id) {
      return res.status(409).json({ success: false, message: 'Duplicate username' })
    }

    user.username = username
    user.roles = roles
    user.active = active
    user.email = email

    const updatedUser = await user.save()

    res.status(200).json({ success: true, message: `${updatedUser.username} updated` })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const deleteUserById = async (req: Request, res: Response) => {
  const { id } = req.params

  if (!id) {
    return res.status(400).json({ success: false, message: 'User ID is required' })
  }

  try {
    const job = await Job.findOne({ user: id }).lean().exec()
    if (job) {
      return res.status(400).json({ success: false, message: 'User has jobs' })
    }

    const user = await User.findById(id).exec()

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const deleteResult = await user.deleteOne()

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No user was deleted' })
    }

    const reply = `Username ${user.username} with ID ${user._id} deleted`

    res.status(200).json({ success: true, message: reply })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const deleteUserByUsername = async (req: Request, res: Response) => {
  try {
    const username = req.params.username
    if (!username || !isValidUsername(username)) {
      return res.status(400).json({ success: false, message: 'Invalid username format' })
    }

    const user = await User.findOne({ username }).exec()
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const job = await Job.findOne({ user: user._id }).lean().exec()
    if (job) {
      return res.status(409).json({ success: false, message: 'User has assigned jobs' })
    }

    const deleteResult = await user.deleteOne()
    if (deleteResult.deletedCount === 0) {
      return res.status(500).json({ success: false, message: 'Failed to delete user' })
    }

    const reply = `User ${user.username} with ID ${user._id} deleted`
    res.status(200).json({ success: true, message: reply })
  } catch (error) {
    logger.error('Error during user deletion:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const getUser = async (req: Request, res: Response) => {
  if (!req?.params?.id) {
    return res.status(400).json({ success: false, message: 'User ID is required' })
  }

  try {
    const user = await User.findOne({ _id: req.params.id }).lean().exec()
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: `User ID ${req.params.id} not found` })
    }
    res.json({ success: true, data: user })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const sendChangeEmailOtp = async (req: Request, res: Response) => {
  try {
    const { username, currentEmail, newEmail } = req.body

    if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' })
    }

    const user = await User.findOne({ username })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    if (user.email === newEmail) {
      return res.status(400).json({
        success: false,
        message: 'The new email is the same as the current email.'
      })
    }

    const duplicate = await User.findOne({ email: newEmail })
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Duplicate email' })
    }

    if (user.email !== currentEmail) {
      return res
        .status(400)
        .json({ success: false, message: 'Current email does not match' })
    }

    const otpCode = generateOtp()

    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    }
    await user.save()

    await sendOtpEmail(currentEmail, otpCode)

    res.status(200).json({ success: true, message: 'OTP sent successfully' })
  } catch (error) {
    logger.error('Failed to send change email OTP:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { username, otp, currentEmail, newEmail } = req.body

    if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' })
    }

    const user = await User.findOne({ username })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    if (
      user.otp?.code !== otp ||
      (user.otp?.expiresAt && user.otp.expiresAt < new Date())
    ) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' })
    }

    user.previousEmails.push(currentEmail)
    user.email = newEmail
    user.otp = null
    await user.save()

    res.status(200).json({ success: true, message: 'Email address updated successfully' })
  } catch (error) {
    logger.error('Failed to verify OTP:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const resendOtp = async (req: Request, res: Response) => {
  try {
    const { username } = req.body

    if (!username || !isValidUsername(username)) {
      return res.status(400).json({ success: false, message: 'Invalid username format' })
    }

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const otpCode = generateOtp()

    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    }
    await user.save()

    await sendOtpEmail(user.email, otpCode)

    res.status(200).json({ success: true, message: 'OTP resent successfully' })
  } catch (error) {
    logger.error('Failed to resend OTP:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

function generateOtp(): string {
  const otp = crypto.randomBytes(3).toString('hex') // Generates a 6-character OTP
  return otp
}

export {
  getAllUsers,
  updateUser,
  deleteUserById,
  deleteUserByUsername,
  getUser,
  sendChangeEmailOtp,
  verifyOtp,
  resendOtp
}
