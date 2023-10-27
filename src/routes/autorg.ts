import express from 'express'
const router = express.Router()
import { getAutoRg } from '../controllers/jobsController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router.route('/').post(getAutoRg)

module.exports = router
