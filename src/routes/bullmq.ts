import express from 'express'
const router = express.Router()
import { getQueueStatus } from '../controllers/bullmqController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router.route('/').get(getQueueStatus)

module.exports = router
