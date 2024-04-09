import express from 'express'
const router = express.Router()
import { generateMagickLink } from '../controllers/magickLinkController'

router.post('/', generateMagickLink)

module.exports = router
