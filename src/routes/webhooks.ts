import express from 'express'
import { handleWebhook } from 'controllers/webhooksController.js'
import verifyGitHubSecret from 'middleware/verifyGitHubSecret.js'

const router = express.Router()

router.use(verifyGitHubSecret)

router.route('/github/:event').post(handleWebhook)

module.exports = router
