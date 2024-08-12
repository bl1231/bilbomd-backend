import express from 'express'
import { getConfigsStuff } from '../controllers/configsController'
import verifyJWT from '../middleware/verifyJWT'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getConfigsStuff)

export default router
