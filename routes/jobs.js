const express = require('express')
const router = express.Router()
const jobController = require('../controllers/jobsController')
const verifyJWT = require('../middleware/verifyJWT')

router.use(verifyJWT)

router
  .route('/')
  .get(jobController.getAllJobs)
  .post(jobController.createNewJob)
  .patch(jobController.updateJobStatus)

router.route('/:id').get(jobController.getJobById)
router.route('/:id').delete(jobController.deleteJob)
router.route('/:id/results').get(jobController.downloadJobResults)
router.route('/bilbomd-auto').post(jobController.createNewJob)

module.exports = router
