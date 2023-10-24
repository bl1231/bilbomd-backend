import express from 'express'
const router = express.Router()
import usersController from '../controllers/usersController'
import verifyJWT from '../middleware/verifyJWT'

router.use(verifyJWT)

router
  .route('/')
  .get(usersController.getAllUsers)
  //.post(usersController.createNewUser)
  .patch(usersController.updateUser)
  .delete(usersController.deleteUser)

router.route('/:id').get(usersController.getUser)

module.exports = router
