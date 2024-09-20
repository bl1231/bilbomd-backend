import { User } from '@bl1231/bilbomd-mongodb-schema'
import { Job } from '@bl1231/bilbomd-mongodb-schema'
import { logger } from '../middleware/loggers.js'
import { Request, Response } from 'express'
import { sendOtpEmail } from './../config/nodemailerConfig.js'

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A JSON array of user objects. Returns an empty array if no users are found.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Internal server error. Indicates an unexpected condition encountered on the server.
 */
const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean()
    res.json(users)
  } catch (error) {
    console.error(error)
    logger.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * @openapi
 * /users:
 *   patch:
 *     summary: Update User
 *     description: Updates an existing user's information.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
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
 *     summary: Delete a user
 *     description: Deletes a user by ID. Fails if the user has assigned jobs or if the user does not exist.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique identifier of the user to delete.
 *         schema:
 *           type: string
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
 *                   description: Confirmation message of deletion.
 *                   example: "Username johndoe with ID 12345 deleted"
 *       400:
 *         description: User ID not provided or user has assigned jobs and cannot be deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *                   example: "User ID Required"
 *       404:
 *         description: User not found or no user was deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *                   example: "User not found"
 */
// const deleteUser = async (req: Request, res: Response) => {
//   const { id } = req.params

//   // Confirm data
//   if (!id) {
//     return res.status(400).json({ message: 'User ID Required' })
//   }

//   // Does the user still have assigned jobs?
//   const job = await Job.findOne({ user: id }).lean().exec()
//   if (job) {
//     return res.status(400).json({ message: 'User has jobs' })
//   }

//   // Does the user exist to delete?
//   const user = await User.findById(id).exec()

//   if (!user) {
//     return res.status(400).json({ message: 'User not found' })
//   }

//   const deleteResult = await user.deleteOne()

//   // Check if a document was actually deleted
//   if (deleteResult.deletedCount === 0) {
//     return res.status(404).json({ message: 'No user was deleted' })
//   }

//   const reply = `Username ${user.username} with ID ${user._id} deleted`

//   res.status(200).json({ message: reply })
// }
const deleteUserById =  async (req: Request, res: Response) => {
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

// sinilar to deleteUserById but using username
const deleteUserByUsername = async (req: Request, res: Response) => {
  try {
    const username  = req.params.username;
    if (!username) {
      return res.status(400).json({ message: 'Username required' });
    }

    const user = await User.findOne({ username }).exec();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user has assigned jobs
    const job = await Job.findOne({ user: user._id }).lean().exec();
    if (job) {
      return res.status(409).json({ message: 'User has assigned jobs' });
    }

    // Delete the user
    const deleteResult = await user.deleteOne();
    if (deleteResult.deletedCount === 0) {
      return res.status(500).json({ message: 'Failed to delete user' });
    }

    const reply = `User ${user.username} with ID ${user._id} deleted`;
    res.status(200).json({ message: reply });
  } catch (error) {
    console.error('Error during user deletion:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get User by ID
 *     description: Retrieves detailed information about a user by their unique identifier.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the user to retrieve.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found and returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: User ID not provided or user with specified ID not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the user ID was not provided or not found.
 *                   example: "User ID required"
 */
const getUser = async (req: Request, res: Response) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'User ID required' })
  const user = await User.findOne({ _id: req.params.id }).lean().exec()
  if (!user) {
    return res.status(400).json({ message: `User ID ${req.params.id} not found` })
  }
  res.json(user)
}
/**
 * @openapi
 * First, update the IUser interface in your TypeScript code to include the new fields that are emailVerificationOtp,emailVerificationOtpExpires,previousEmail
 * interface IUser extends Document {
    username: string;
    roles: string[];
    refreshToken: string[];
    email: string;
    status: string;
    active: boolean;
    confirmationCode: IConfirmationCode | null;
    otp: IOtp | null;
    UUID: string;
    createdAt: Date;
    last_access: Date;
    jobs: IJob | null;
    emailVerificationOtp: string | null;
    emailVerificationOtpExpires: Date | null;
    previousEmail: string | null;
}
    and Updating in mongo schema
import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
    username: string;
    roles: string[];
    refreshToken: string[];
    email: string;
    status: string;
    active: boolean;
    confirmationCode: IConfirmationCode | null;
    otp: IOtp | null;
    UUID: string;
    createdAt: Date;
    last_access: Date;
    jobs: IJob | null;
    emailVerificationOtp: string | null;
    emailVerificationOtpExpires: Date | null;
    previousEmail: string | null;
}

const UserSchema: Schema = new Schema({
    username: { type: String, required: true },
    roles: { type: [String], required: true },
    refreshToken: { type: [String], required: true },
    email: { type: String, required: true },
    status: { type: String, required: true },
    active: { type: Boolean, required: true },
    confirmationCode: { type: Schema.Types.Mixed, default: null },
    otp: { type: Schema.Types.Mixed, default: null },
    UUID: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    last_access: { type: Date, default: Date.now },
    jobs: { type: Schema.Types.Mixed, default: null },
    emailVerificationOtp: { type: String, default: null },
    emailVerificationOtpExpires: { type: Date, default: null },
    previousEmail: { type: String, default: null }
});

  const User = mongoose.model<IUser>('User', UserSchema);

  export default User;
 */

/**
 * @openapi
 * /users/change-email:
 *   post:
 *     summary: Send Change Email OTP
 *     description: Initiates the email change process by sending an OTP to the user's current email address for verification.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique identifier of the user.
 *               username:
 *                 type: string
 *                 description: Username of the user.
 *               currentEmail:
 *                 type: string
 *                 description: Current email address of the user.
 *               newEmail:
 *                 type: string
 *                 description: New email address to be set for the user.
 *     responses:
 *       200:
 *         description: OTP sent successfully to the user's current email address.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message indicating the OTP was sent.
 *                   example: "OTP sent successfully"
 *       400:
 *         description: Current email does not match the email stored in the database for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the current email does not match.
 *                   example: "Current email does not match"
 *       404:
 *         description: User not found with the provided user ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the user was not found.
 *                   example: "User not found"
 *       500:
 *         description: Internal server error occurred while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating an internal server error.
 *                   example: "Internal server error"
 */

// Controller for sending email change request
const sendChangeEmailOtp = async (req: Request, res: Response) => {
  try {
    const { username, currentEmail, newEmail } = req.body;

    // Retrieve user details from the database using the username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // verify that the newEmail is not the same as the current email
    if (user.email === newEmail) {
      return res.status(400).json({ message: 'New email is the same as the current email' });
    }
    //verify that the newEmail is not there in not any other users current email
    const duplicate = await User.findOne({ email: newEmail })
    if (duplicate) {
      return res.status(409).json({ message: 'Duplicate email' })
    }
    // Verify that the current email matches the email in the database
    if (user.email !== currentEmail) {
      return res.status(400).json({ message: 'Current email does not match' });
    }

    // Generate a random 6-digit OTP
    const otpCode = generateOtp(); //generateOtp();

    // Store the OTP and expiration time in the database
    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    };
    await user.save();

    // Send the OTP to the current email address
    await sendOtpEmail(currentEmail, otpCode);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Failed to send change email OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


//#region 
// Need to create three keys in mongodb database for user entity
// emailVerificationOtp,previosEmail and emailVerificationOtpExpires


/**
 * @openapi
 * /users/verify-otp:
 *   post:
 *     summary: Verify OTP for Email Change
 *     description: Verifies the OTP sent to the user's current email and updates the email address if valid.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique identifier of the user.
 *               otp:
 *                 type: string
 *                 description: One-time password sent to the user's email.
 *               currentEmail:
 *                 type: string
 *                 description: Current email address of the user.
 *               newEmail:
 *                 type: string
 *                 description: New email address to be set for the user.
 *     responses:
 *       200:
 *         description: Email address updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message indicating the email was updated.
 *                   example: "Email address updated successfully"
 *       400:
 *         description: Invalid or expired OTP.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the OTP is invalid or expired.
 *                   example: "Invalid or expired OTP"
 *       404:
 *         description: User not found with the provided user ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the user was not found.
 *                   example: "User not found"
 *       500:
 *         description: Internal server error occurred while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating an internal server error.
 *                   example: "Internal server error"
 */
const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { username, otp, currentEmail, newEmail } = req.body;

    // Retrieve user details from the database
    const user = await User.findOne({username});

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the provided OTP matches the stored OTP and is not expired
    if (user.otp?.code !== otp || (user.otp?.expiresAt && user.otp.expiresAt < new Date())) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update the email addresses in the database
    user.previousEmails.push(currentEmail);
    user.email = newEmail;
    user.otp = null;
    await user.save();

    res.status(200).json({ message: 'Email address updated successfully' });
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
 /**
 * @openapi
 * /users/resend-otp:
 *   post:
 *     summary: Resend OTP for Email Verification
 *     description: Resends a new OTP to the user's current email address for verification.
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique identifier of the user.
 *     responses:
 *       200:
 *         description: OTP resent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message indicating the OTP was resent.
 *                   example: "OTP resent successfully"
 *       404:
 *         description: User not found with the provided user ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the user was not found.
 *                   example: "User not found"
 *       500:
 *         description: Internal server error occurred while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating an internal server error.
 *                   example: "Internal server error"
 */
 const resendOtp = async (req: Request, res: Response) => {
  try {
    //const { userId } = req.body;
    const { username } = req.body;

    // Retrieve user details from the database
    //const user = await User.findById(userId);
    const user=await User.findOne({username});
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a new random 6-digit OTP
    const otpCode = generateOtp();

    // Update the OTP and expiration time in the database
    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    };
    await user.save();

    // Send the new OTP to the current email address
    await sendOtpEmail(user.email, otpCode);

    res.status(200).json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('Failed to resend OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

//#region  Generating the otp
function generateOtp(): string {
  const digits = '0123456789';
  let otp = '';

  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }

  return otp;
}
//#endregion
export { getAllUsers, updateUser, deleteUserById, deleteUserByUsername, getUser,sendChangeEmailOtp,verifyOtp,resendOtp }
