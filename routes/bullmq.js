const express = require('express')
const router = express.Router()
const { getQueueStatus } = require('../controllers/bullmqController')
const verifyJWT = require('../middleware/verifyJWT')

router.use(verifyJWT)

router.route('/').get(getQueueStatus)

module.exports = router
