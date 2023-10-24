import express from 'express'
const router = express.Router()
import jobController from '../controllers/jobsController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router.route('/').post(jobController.getAutoRg)

module.exports = router
