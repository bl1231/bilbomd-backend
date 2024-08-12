import express from 'express'
import { getStatus, getUser, getProjectHours } from '../controllers/sfapiController'
import { ensureSFAuthenticated } from '../middleware/tokenManager'
// import verifyJWT from '../middleware/verifyJWT'

const router = express.Router()

// router.use(verifyJWT)

// Unauthenticated routes first
router.route('/status').get(getStatus)

// Our custom middleware to get and apply an accessToken.
router.use(ensureSFAuthenticated)

// Protected routes
router.route('/account').get(getUser)
router.route('/account/projects/:repocode').get(getProjectHours)

export default router
