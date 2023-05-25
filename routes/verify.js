const express = require('express')
const router = express.Router()
const verifyController = require('../controllers/verifyController')

router.route('/').post(verifyController.verifyNewUser)
router.route('/resend').post(verifyController.resendVerificationCode)

module.exports = router
