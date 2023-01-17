const express = require('express');
const router = express.Router();
const magickLinkController = require('../controllers/magickLinkController');

router.post('/', magickLinkController.generateMagickLink);

module.exports = router;
