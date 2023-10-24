import express from 'express'
const router = express.Router()
import authController from '../controllers/authController'
import loginLimiter from '../middleware/loginLimiter'

router.route('/otp').post(loginLimiter, authController.otp)
router.route('/refresh').get(authController.refresh)
router.route('/logout').post(authController.logout)

module.exports = router
