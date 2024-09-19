import express from 'express'
import {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser,
  sendChangeEmailOtp,
  verifyOtp,
  resendOtp
} from '../controllers/usersController.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getAllUsers).patch(updateUser)

router.route('/:id').get(getUser).delete(deleteUser)

// Route for sending email change request
router.post('/change-email',sendChangeEmailOtp);

//Route for verifying OTP
router.post('/verify-otp',verifyOtp);

// Route for resending otp
router.post('/resend-otp',resendOtp);

export default router
