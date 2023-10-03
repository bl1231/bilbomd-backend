const express = require('express')
const router = express.Router()
// const af2paeController = require('../controllers/af2paeController')
const {
  createNewConstFile,
  downloadConstFile
} = require('../controllers/af2paeController')
const verifyJWT = require('../middleware/verifyJWT')

router.use(verifyJWT)

router.route('/').get(downloadConstFile).post(createNewConstFile)

// router.route('/:uuid/const.inp').get(downloadConstFile)

module.exports = router
