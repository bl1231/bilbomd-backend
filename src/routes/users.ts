import express from 'express'
import {
  getAllUsers,
  updateUser,
  deleteUserById,
  getUser,
  sendChangeEmailOtp,
  verifyOtp,
  resendOtp,
  deleteUserByUsername
} from '../controllers/usersController.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getAllUsers).patch(updateUser)

router.route('/:id').get(getUser).delete(deleteUserById)

router.delete('/delete-user-by-username/:username',deleteUserByUsername)
// Route for sending email change request
router.post('/change-email',sendChangeEmailOtp);

//Route for verifying OTP
router.post('/verify-otp',verifyOtp);

// Route for resending otp
router.post('/resend-otp',resendOtp);

export default router
