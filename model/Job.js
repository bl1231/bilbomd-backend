const mongoose = require('mongoose')
const Schema = mongoose.Schema

const jobSchema = new Schema(
  {
    title: {
      type: String,
      required: true
    },
    uuid: { type: String, required: true },
    psf_file: { type: String, required: true },
    crd_file: { type: String, required: true },
    data_file: { type: String, required: true },
    status: {
      type: String,
      enum: ['Submitted', 'Pending', 'Running', 'Completed', 'Error'],
      default: 'Submitted'
    },
    time_submitted: { type: Date, default: () => new Date(Date.now()) },
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
)

const bilboMdJobSchema = new Schema(
  {
    const_inp_file: { type: String, required: true },
    conformational_sampling: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1
    },
    rg_min: { type: Number, required: true, min: 10, max: 100 },
    rg_max: { type: Number, required: true, min: 10, max: 100 }
  },
  {
    timestamps: true
  }
)

const bilboMdAutoJobSchema = new Schema(
  {
    const_inp_file: { type: String, required: false },
    pae_file: { type: String, required: true },
    conformational_sampling: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1
    },
    rg_min: { type: Number },
    rg_max: { type: Number }
  },
  {
    timestamps: true
  }
)

const Job = mongoose.model('Job', jobSchema)
const BilboMdJob = Job.discriminator('BilboMd', bilboMdJobSchema)
const BilboMdAutoJob = Job.discriminator('BilboMdAuto', bilboMdAutoJobSchema)

module.exports = { Job, BilboMdJob, BilboMdAutoJob }
