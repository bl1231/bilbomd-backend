import express from 'express'
import { generateMagickLink } from '../controllers/magickLinkController'

const router = express.Router()

router.post('/', generateMagickLink)

export default router
