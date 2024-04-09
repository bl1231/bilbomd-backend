import express from 'express'
import {
  getAllJobs,
  createNewJob,
  deleteJob,
  updateJobStatus,
  downloadJobResults,
  getJobById,
  getLogForStep
} from '../controllers/jobsController'
import { downloadPDB, getFoxsData } from '../controllers/downloadController'
import verifyJWT from '../middleware/verifyJWT'
const router = express.Router()

if (process.env.NODE_ENV === 'production') {
  router.use(verifyJWT)
}

router.route('/').get(getAllJobs).post(createNewJob).patch(updateJobStatus)

router.route('/:id').get(getJobById)
router.route('/:id').delete(deleteJob)
router.route('/:id/results').get(downloadJobResults)
router.route('/:id/results/foxs').get(getFoxsData)
router.route('/:id/results/:pdb').get(downloadPDB)
router.route('/:id/logs').get(getLogForStep)
router.route('/bilbomd-auto').post(createNewJob)
router.route('/bilbomd-scoper').post(createNewJob)

module.exports = router
