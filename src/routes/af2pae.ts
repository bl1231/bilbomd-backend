import express from 'express'
import { createNewConstFile, downloadConstFile } from '../controllers/af2paeController.js'
import { verifyJWT } from '../middleware/verifyJWT.js'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(downloadConstFile).post(createNewConstFile)

// router.route('/:uuid/const.inp').get(downloadConstFile)

export default router
