import express from 'express'
import { otp, refresh, logout } from '../controllers/authController.js'
import { handleOrcidLogin } from '../controllers/auth/handleOrcidLogin.js'
import { handleOrcidCallback } from '../controllers/auth/handleOrcidCallback.js'
import { loginLimiter } from '../middleware/loginLimiter.js'

const router = express.Router()

router.route('/otp').post(loginLimiter, otp)
router.route('/refresh').get(refresh)
router.route('/logout').post(logout)

router.route('/orcid').get(handleOrcidLogin)
router.route('/orcid/callback').get(handleOrcidCallback)
export default router
