import express from 'express'
const router = express.Router()
import { verifyNewUser, resendVerificationCode } from '../controllers/verifyController'

router.route('/').post(verifyNewUser)
router.route('/resend').post(resendVerificationCode)

module.exports = router
