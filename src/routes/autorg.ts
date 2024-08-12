import express from 'express'
import { getAutoRg } from '../controllers/jobsController'
import verifyJWT from '../middleware/verifyJWT'

const router = express.Router()

router.use(verifyJWT)

router.route('/').post(getAutoRg)

export default router
