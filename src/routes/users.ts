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
router.delete('/delete-user-by-username/:username', deleteUserByUsername)
router.post('/change-email', sendChangeEmailOtp)
router.post('/verify-otp', verifyOtp)
router.post('/resend-otp', resendOtp)
export default router
