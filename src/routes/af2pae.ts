import express from 'express'
const router = express.Router()
import { createNewConstFile, downloadConstFile } from '../controllers/af2paeController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router.route('/').get(downloadConstFile).post(createNewConstFile)

// router.route('/:uuid/const.inp').get(downloadConstFile)

module.exports = router
