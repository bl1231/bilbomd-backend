const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const jobSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  const_inp_file: { type: String },
  data_file: { type: String, required: true },
  conformational_sampling: {
    type: Number,
    enum: [200, 400, 600, 800],
    default: 200
  },
  rg_min: { type: Number, reqired: true, minimum: 10, maximum: 100 },
  rg_max: { type: Number, reqired: true, minimum: 10, maximum: 100 },
  status: {
    type: String,
    enum: ['Submitted', 'Pending', 'Running', 'Completed', 'Error'],
    default: 'Submitted'
  },
  time_submitted: Date,
  time_started: Date,
  time_completed: Date,
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Job', jobSchema);
