import express from 'express'
import {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser
} from '../controllers/usersController.js'
import { verifyJWT } from '../middleware/verifyJWT.js'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getAllUsers).patch(updateUser)

router.route('/:id').get(getUser).delete(deleteUser)

export default router
