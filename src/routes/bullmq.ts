import express from 'express'
import { getQueueStatus } from '../controllers/bullmqController'
import verifyJWT from '../middleware/verifyJWT'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getQueueStatus)

export default router
