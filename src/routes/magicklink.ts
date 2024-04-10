import express from 'express'
import { generateMagickLink } from '../controllers/magickLinkController'

const router = express.Router()

router.post('/', generateMagickLink)

module.exports = router
