import { User } from '../model/User'
import { Job } from '../model/Job'
import { logger } from '../middleware/loggers'
import { Request, Response } from 'express'

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users.
 *     tags:
 *       - User Management
 *     responses:
 *       200:
 *         description: Users retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: No users found.
 *       500:
 *         description: Internal server error.
 */
const getAllUsers = async (req: Request, res: Response) => {
  const users = await User.find().lean()
  if (!users) return res.status(400).json({ message: 'No users found' })
  res.json(users)
}

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     summary: Update User
 *     description: Updates an existing user's information.
 *     tags:
 *       - User Management
 *     requestBody:
 *       description: User object to update.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user to update.
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       '400':
 *         description: Bad request. Invalid input or missing fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       '409':
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
const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params
  const { username, roles, active, email } = req.body
  logger.info(`updateUser ${id} ${username} ${email}`)
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
  // logger.info('found user: %s', user)

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

  const updatedUser = await user.save()

  res.status(200).json({ message: `${updatedUser.username} updated` })
}

/**
 * @openapi
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
const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'User ID Required' })
  }

  // Does the user still have assigned jobs?
  const job = await Job.findOne({ user: id }).lean().exec()
  if (job) {
    return res.status(400).json({ message: 'User has jobs' })
  }

  // Does the user exist to delete?
  const user = await User.findById(id).exec()

  if (!user) {
    return res.status(400).json({ message: 'User not found' })
  }

  const deleteResult = await user.deleteOne()

  // Check if a document was actually deleted
  if (deleteResult.deletedCount === 0) {
    return res.status(404).json({ message: 'No user was deleted' })
  }

  const reply = `Username ${user.username} with ID ${user._id} deleted`

  res.status(200).json({ message: reply })
}

/**
 * @openapi
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
 *               $ref: '#/components/schemas/User'
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
const getUser = async (req: Request, res: Response) => {
  const { id } = req.params
  if (!id) return res.status(404).json({ message: 'User ID required' })
  const user = await User.findOne({ _id: req.params.id }).lean().exec()
  if (!user) {
    return res.status(404).json({ message: `User ID ${req.params.id} not found` })
  }
  res.json(user)
}

export { getAllUsers, updateUser, deleteUser, getUser }
