import express from 'express'
import { otp, refresh, logout } from '../controllers/authController.js'
import { loginLimiter } from '../middleware/loginLimiter.js'

const router = express.Router()

router.route('/otp').post(loginLimiter, otp)
router.route('/refresh').get(refresh)
router.route('/logout').post(logout)

export default router
