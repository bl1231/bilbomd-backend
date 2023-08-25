const express = require('express')
const router = express.Router()
// const af2paeController = require('../controllers/af2paeController')
const { createNewConstFile } = require('../controllers/af2paeController')
const verifyJWT = require('../middleware/verifyJWT')

// router.use(verifyJWT)

router.post('/', createNewConstFile)

module.exports = router
