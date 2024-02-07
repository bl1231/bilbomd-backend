import express from 'express'
const router = express.Router()
import {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser
} from '../controllers/usersController'
import verifyJWT from '../middleware/verifyJWT'

if (process.env.NODE_ENV === 'production') {
  router.use(verifyJWT)
}

router.route('/').get(getAllUsers)

router.route('/:id').get(getUser).delete(deleteUser).patch(updateUser)

module.exports = router
