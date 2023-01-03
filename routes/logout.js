const express = require('express');
const router = express.Router();
const logoutController = require('../controllers/logoutController');

router.get('/', logoutController.handleLogout);

console.log('logout\t\trouter loaded');

module.exports = router;