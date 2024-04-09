import express from 'express'
import { getStatus, getUser, getProjectHours } from '../controllers/sfapiController'
import { ensureSFAuthenticated } from '../middleware/tokenManager'

const router = express.Router()

// Unauthenticated routes first
router.route('/status').get(getStatus)

// Our custom middleware to get and apply an accessToken.
router.use(ensureSFAuthenticated)

// Protected routes
router.route('/account').get(getUser)
router.route('/account/projects/:repocode').get(getProjectHours)

module.exports = router
