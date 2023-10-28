import express from 'express'
const router = express.Router()
import {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser
} from '../controllers/usersController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router
  .route('/')
  .get(getAllUsers)
  //.post(createNewUser)
  .patch(updateUser)
  .delete(deleteUser)

router.route('/:id').get(getUser)

module.exports = router
