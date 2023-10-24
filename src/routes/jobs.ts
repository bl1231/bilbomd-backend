import express from 'express'
const router = express.Router()
import jobController from '../controllers/jobsController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router
  .route('/')
  .get(jobController.getAllJobs)
  .post(jobController.createNewJob)
  .patch(jobController.updateJobStatus)

router.route('/:id').get(jobController.getJobById)
router.route('/:id').delete(jobController.deleteJob)
router.route('/:id/results').get(jobController.downloadJobResults)
router.route('/:id/logs').get(jobController.getLogForStep)
router.route('/bilbomd-auto').post(jobController.createNewJob)

module.exports = router
