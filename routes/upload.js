const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

router.post('/pdb', uploadController.handlePdbFileUpload);
router.post('/', uploadController.handleBilbomdFormUpload);

module.exports = router;
