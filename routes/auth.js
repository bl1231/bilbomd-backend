const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const loginLimiter = require('../middleware/loginLimiter')

// just proving to myself that this middleware can "see" OTP in req.body
router.use(function (req, res, next) {
  const { otp } = req.body
  if (otp) {
    console.log('authControl router got OTP', otp)
  }
  next()
})

// router.route('/').post(loginLimiter, authController.login)
router.route('/otp').post(loginLimiter, authController.otp)
router.route('/refresh').get(authController.refresh)
router.route('/logout').post(authController.logout)

module.exports = router
