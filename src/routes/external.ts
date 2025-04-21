import express from 'express'
import { createNewJob } from '../controllers/jobs/index.js'
import { getApiJobStatus } from '../controllers/external/jobStatus.js'
import { getExternalJobResults } from '../controllers/external/getResults.js'
import { verifyAPIToken } from '../middleware/verifyAPIToken.js'

const router = express.Router()

router.use(verifyAPIToken)

router.post('/', createNewJob)
router.get('/:id/status', getApiJobStatus)
router.get('/:id/results', getExternalJobResults)

export default router
