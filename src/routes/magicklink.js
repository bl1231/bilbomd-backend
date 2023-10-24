const express = require('express')
const router = express.Router()
const { generateMagickLink } = require('../controllers/magickLinkController')

router.post('/', generateMagickLink)

module.exports = router
