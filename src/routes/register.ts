import express from 'express'
const router = express.Router()
import { handleNewUser } from '../controllers/registerController'

router.post('/', handleNewUser)

module.exports = router
