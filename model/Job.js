const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const Schema = mongoose.Schema;

const pdbSchema = new Schema({
  name: { type: String, required: true },
  size: { type: Number }
});

const jobSchema = new Schema(
  {
    title: {
      type: String,
      required: true
    },
    uuid: { type: String, required: true },
    const_inp_file: { type: String },
    data_file: { type: String, required: true },
    pdbs: [pdbSchema],
    conformational_sampling: {
      type: Number,
      enum: [200, 400, 600, 800],
      default: 200
    },
    rg_min: { type: Number, required: true, minimum: 10, maximum: 100 },
    rg_max: { type: Number, required: true, minimum: 10, maximum: 100 },
    status: {
      type: String,
      enum: ['Submitted', 'Pending', 'Running', 'Completed', 'Error'],
      default: 'Submitted'
    },
    time_submitted: Date,
    time_started: Date,
    time_completed: Date,
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

jobSchema.plugin(AutoIncrement, {
  inc_field: 'ticket',
  id: 'ticketNums',
  start_seq: 1
});

module.exports = mongoose.model('Job', jobSchema);
