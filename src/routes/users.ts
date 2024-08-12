import express from 'express'
import {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser
} from '../controllers/usersController'
import verifyJWT from '../middleware/verifyJWT'

const router = express.Router()

router.use(verifyJWT)

router.route('/').get(getAllUsers).patch(updateUser)

router.route('/:id').get(getUser).delete(deleteUser)

export default router
