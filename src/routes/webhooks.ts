import express from 'express'
import { handleWebhook } from '../controllers/webhooksController'
import verifyGitHubSecret from '../middleware/verifyGitHubSecret'

const router = express.Router()

router.use(verifyGitHubSecret)

router.route('/github/:event').post(handleWebhook)

module.exports = router
