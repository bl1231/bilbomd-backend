const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  roles: {
    User: {
      type: Number,
      default: 2001
    },
    Editor: Number,
    Admin: Number
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
  confirmationCode: {
    type: String
  },
  otp: { type: String },
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
});

module.exports = mongoose.model('User', userSchema);
