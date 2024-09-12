import express from 'express'
import {
  getAllJobs,
  createNewJob,
  deleteJob,
  updateJobStatus,
  downloadJobResults,
  getJobById,
  getLogForStep
} from '../controllers/jobsController.js'
import { createNewAlphaFoldJob } from '../controllers/alphafoldJobsController.js'
import { downloadPDB, getFoxsData } from '../controllers/downloadController.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getAllJobs).post(createNewJob).patch(updateJobStatus)

router.route('/:id').get(getJobById)
router.route('/:id').delete(deleteJob)
router.route('/:id/results').get(downloadJobResults)
router.route('/:id/results/foxs').get(getFoxsData)
router.route('/:id/results/:pdb').get(downloadPDB)
router.route('/:id/logs').get(getLogForStep)
router.route('/bilbomd-auto').post(createNewJob)
router.route('/bilbomd-scoper').post(createNewJob)
router.route('/bilbomd-alphafold').post(createNewAlphaFoldJob)

export default router
