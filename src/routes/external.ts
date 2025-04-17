import express from 'express'
import { submitApiJob } from '../controllers/external/createJob.js'
import { getApiJobStatus } from '../controllers/external/jobStatus.js'
import { getExternalJobResults } from '../controllers/external/getResults.js'
import { verifyAPIToken } from '../middleware/verifyAPIToken.js'

const router = express.Router()

router.use(verifyAPIToken)

router.post('/', submitApiJob)
router.get('/:id/status', getApiJobStatus)
router.get('/:id/results', getExternalJobResults)

export default router
