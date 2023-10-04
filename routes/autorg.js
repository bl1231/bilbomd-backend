const express = require('express')
const router = express.Router()
const jobController = require('../controllers/jobsController')
const verifyJWT = require('../middleware/verifyJWT')

router.use(verifyJWT)

router.route('/').post(jobController.getAutoRg)

module.exports = router
