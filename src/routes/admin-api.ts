import express from 'express'
import { verifyJWT } from '../middleware/verifyJWT.js'
import { verifyRoles } from '../middleware/verifyRoles.js'
const router = express.Router()
import { getQueues } from '../controllers/admin/getQueues.js'
import { pauseQueue } from '../controllers/admin/pauseQueue.js'
import { resumeQueue } from '../controllers/admin/resumeQueue.js'
router.use(verifyJWT)
router.use(verifyRoles('Admin', 'Manager'))

router.route('/queues').get(getQueues)
router.post('/queues/:queueName/pause', pauseQueue)
router.post('/queues/:queueName/resume', resumeQueue)

export default router
