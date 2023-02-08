const express = require('express')
const router = express.Router()
const jobController = require('../../controllers/jobsController')
const verifyJWT = require('../../middleware/verifyJWT')

router.use(verifyJWT)

router
  .route('/')
  .get(jobController.getAllJobs)
  .post(jobController.createNewJob)
  .patch(jobController.updateJobStatus)
  .delete(jobController.deleteJob)

router.route('/:id').get(jobController.getJobById)

module.exports = router
