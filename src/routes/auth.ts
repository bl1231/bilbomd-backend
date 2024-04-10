import express from 'express'
import { otp, refresh, logout } from '../controllers/authController'
import loginLimiter from '../middleware/loginLimiter'

const router = express.Router()

router.route('/otp').post(loginLimiter, otp)
router.route('/refresh').get(refresh)
router.route('/logout').post(logout)

module.exports = router
