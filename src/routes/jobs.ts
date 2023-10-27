import express from 'express'
const router = express.Router()
import {
  getAllJobs,
  createNewJob,
  deleteJob,
  updateJobStatus,
  downloadJobResults,
  getJobById,
  getLogForStep
} from '../controllers/jobsController'
// import verifyJWT from '../middleware/verifyJWT'

// router.use(verifyJWT)

router.route('/').get(getAllJobs).post(createNewJob).patch(updateJobStatus)

router.route('/:id').get(getJobById)
router.route('/:id').delete(deleteJob)
router.route('/:id/results').get(downloadJobResults)
router.route('/:id/logs').get(getLogForStep)
router.route('/bilbomd-auto').post(createNewJob)

module.exports = router
