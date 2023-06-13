const express = require('express')
const router = express.Router()
const {
  verifyNewUser,
  resendVerificationCode
} = require('../controllers/verifyController')

router.route('/').post(verifyNewUser)
router.route('/resend').post(resendVerificationCode)

module.exports = router
