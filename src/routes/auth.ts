import express from 'express'
const router = express.Router()
import { otp, refresh, logout } from '../controllers/authController'
import loginLimiter from '../middleware/loginLimiter'

router.route('/otp').post(loginLimiter, otp)
router.route('/refresh').get(refresh)
router.route('/logout').post(logout)

module.exports = router
