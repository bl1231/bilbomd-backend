const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.use(function (req, res, next) {
    const { otp } = req.body;
    if (otp) {
        console.log('authControl router got OTP', otp);
    }
    next();
});

router.post('/otp', authController.handleOTP);
router.post('/', authController.handleLogin);

module.exports = router;
