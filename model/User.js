const mongoose = require('mongoose')
const Schema = mongoose.Schema

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true
    },
    roles: {
      type: [String],
      default: ['User']
    },
    refreshToken: [String],
    email: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Active'],
      default: 'Pending'
    },
    active: {
      type: Boolean,
      default: true
    },
    confirmationCode: {
      type: String,
      unique: true
    },
    otp: {
      code: {
        type: String,
        unique: true
      },
      expiresAt: {
        type: Date
      }
    },
    UUID: {
      type: String
    },
    createdAt: Date,
    last_access: Date,
    jobs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Job'
      }
    ]
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('User', userSchema)
