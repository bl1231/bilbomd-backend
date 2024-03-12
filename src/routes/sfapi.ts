import express from 'express'
import { getStatus, getUser, getProjectHours } from '../controllers/sfapiController'
import { ensureSFAuthenticated } from '../middleware/tokenManager'

const router = express.Router()

router.use(ensureSFAuthenticated)

router.route('/status').get(getStatus)
router.route('/account').get(getUser)
router.route('/account/projects/:repocode').get(getProjectHours)

module.exports = router
