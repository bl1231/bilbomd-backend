import express from 'express'
// import { verifyJWT } from '../middleware/verifyJWT.js'
// import { verifyRoles } from '../middleware/verifyRoles.js'
const router = express.Router()
import { getQueues } from '../controllers/admin/getQueues.js'
// router.use(verifyJWT)
// router.use(verifyRoles('Admin', 'Manager'))

router.route('/queues').get(getQueues)

export default router
