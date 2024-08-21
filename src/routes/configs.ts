import express from 'express'
import { getConfigsStuff } from '../controllers/configsController.js'
// import verifyJWT from '../middleware/verifyJWT.js'

const router = express.Router()

// router.use(verifyJWT)

router.route('/').get(getConfigsStuff)

export default router
