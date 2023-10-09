const User = require('../model/User')
const Job = require('../model/Job')
const { logger } = require('../middleware/loggers')

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get All Users
 *     description: Retrieves a list of all users.
 *     tags:
 *       - User Management
 *     responses:
 *       200:
 *         description: List of users retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   username:
 *                     type: string
 *                     description: The username of the user.
 *                   email:
 *                     type: string
 *                     description: The email address of the user.
 *       400:
 *         description: No users found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const getAllUsers = async (req, res) => {
  const users = await User.find().lean()
  if (!users) return res.status(400).json({ message: 'No users found' })
  res.json(users)
}

// @desc Create new user
// @route POST /users
// @access Private

// do this in register?

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update User
 *     description: Updates an existing user's information.
 *     tags:
 *       - User Management
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user to update.
 *       - in: body
 *         name: user
 *         required: true
 *         description: The user object to update.
 *         schema:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: The ID of the user.
 *             username:
 *               type: string
 *               description: The updated username.
 *             roles:
 *               type: array
 *               items:
 *                 type: string
 *               description: The updated roles of the user.
 *             active:
 *               type: boolean
 *               description: The updated active status of the user.
 *             email:
 *               type: string
 *               description: The updated email address of the user.
 *     responses:
 *       200:
 *         description: User updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       409:
 *         description: Conflict. Duplicate username found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const updateUser = async (req, res) => {
  const { id, username, roles, active, email } = req.body

  // Confirm data
  if (
    !id ||
    !username ||
    !Array.isArray(roles) ||
    !roles.length ||
    typeof active !== 'boolean' ||
    !email
  ) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  // Does the user exist to update?
  const user = await User.findById(id).exec()
  logger.info('found user: %s', user)

  if (!user) {
    return res.status(400).json({ message: 'User not found' })
  }

  // Check for duplicate
  const duplicate = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec()

  // Allow updates to the original user
  if (duplicate && duplicate?._id.toString() !== id) {
    return res.status(409).json({ message: 'Duplicate username' })
  }

  user.username = username
  user.roles = roles
  user.active = active
  user.email = email

  // if (password) {
  //   // Hash password
  //   user.password = await bcrypt.hash(password, 10) // salt rounds
  // }

  const updatedUser = await user.save()

  res.status(200).json({ message: `${updatedUser.username} updated` })
}

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete User
 *     description: Deletes an existing user by their ID.
 *     tags:
 *       - User Management
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user to delete.
 *     responses:
 *       200:
 *         description: User deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const deleteUser = async (req, res) => {
  const { id } = req.body

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'User ID Required' })
  }

  // Does the user still have assigned notes?
  const job = await Job.findOne({ user: id }).lean().exec()
  if (job) {
    return res.status(400).json({ message: 'User has jobs' })
  }

  // Does the user exist to delete?
  const user = await User.findById(id).exec()

  if (!user) {
    return res.status(400).json({ message: 'User not found' })
  }

  const result = await user.deleteOne()

  const reply = `Username ${result.username} with ID ${result._id} deleted`

  res.status(200).json({ message: reply })
}

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get User by ID
 *     description: Retrieves user information by their ID.
 *     tags:
 *       - User Management
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user to retrieve.
 *     responses:
 *       200:
 *         description: User retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                   description: The username of the user.
 *                 email:
 *                   type: string
 *                   description: The email address of the user.
 *       400:
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
const getUser = async (req, res) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'User ID required' })
  const user = await User.findOne({ _id: req.params.id }).lean().exec()
  if (!user) {
    return res.status(400).json({ message: `User ID ${req.params.id} not found` })
  }
  res.json(user)
}

module.exports = {
  getAllUsers,
  updateUser,
  deleteUser,
  getUser
}
