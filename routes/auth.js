const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/', authController.handleLogin);

console.log('auth\t\trouter loaded');

module.exports = router;