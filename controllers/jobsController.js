const { logger } = require('../middleware/loggers')
const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid')
const jobQueue = require('../queues/jobQueue')
const Job = require('../model/Job')
const User = require('../model/User')

const uploadFolder = path.join(process.env.DATA_VOL)

// @desc Get all jobs
// @route GET /jobs
// @access Private
const getAllJobs = async (req, res) => {
  const jobs = await Job.find().lean()
  // If no jobs
  if (!jobs?.length) {
    return res.status(400).json({ message: 'No jobs found' })
  }

  // Add username to each job before sending the response
  // See Promise.all with map() here: https://youtu.be/4lqJBBEpjRE
  // You could also do this with a for...of loop
  const jobsWithUser = await Promise.all(
    jobs.map(async (job) => {
      const user = await User.findById(job.user).lean().exec()
      return { ...job, username: user?.username }
    })
  )
  res.json(jobsWithUser)
}

// @desc Create new job
// @route POST /jobs
// @access Private
const createNewJob = async (req, res) => {
  const form = new formidable.IncomingForm()
  const files = []
  const fields = []
  form.multiples = true
  form.keepExtensions = true
  form.maxFileSize = 500 * 1024 * 1024 //5MB
  form.uploadDir = uploadFolder

  // create a unique folder for each job submission using UUIDs
  const UUID = uuid()

  // const jobDir = path.join(form.uploadDir, UUID, 'fit')
  const jobDir = path.join(form.uploadDir, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('created %s', jobDir)
  } catch (error) {
    logger.error(error)
  }

  // grab all the multi-part formdata and fill our arrays
  form
    .on('field', (fieldName, value) => {
      // Capture the non-file field values here
      logger.info('got field: %s with value: %s', fieldName, value)
      fields.push({ fieldName, value })
    })
    .on('fileBegin', (fieldName, file) => {
      // accessible here
      // fieldName the name in the form (<input name="thisname" type="file">) or http filename for octetstream
      // file.originalFilename http filename or null if there was a parsing error
      // file.newFilename generated hexoid or what options.filename returned
      // file.filepath default pathname as per options.uploadDir and options.filename
      // file.filepath = CUSTOM_PATH // to change the final path
      file.filepath = path.join(form.uploadDir, UUID, file.originalFilename)
      logger.info('file: %s', file.originalFilename)
    })
    .on('file', (fieldName, file) => {
      // same as fileBegin, except
      // it is too late to change file.filepath
      // file.hash is available if options.hash was used
      files.push({ fieldName, file })
    })
    .on('progress', (bytesReceived, bytesExpected) => {
      // what do I do in here?
      let progress = Math.round((bytesReceived / bytesExpected) * 100)
      console.log(progress, '%')
    })
    .on('end', () => {
      logger.info('upload done')
    })

  // parse the form
  form.parse(req, async (err, fields, files) => {
    // catch the errors
    if (err) {
      logger.error('Error parsing files %s', err)
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      })
    }

    logger.info('Got fields: %s', fields)

    // find the user
    const user = await User.findOne({ email: fields.email }).exec()

    if (!user) return res.sendStatus(401) //Unauthorized

    // look inside files and check they are legit

    // Create new job in MongoDB

    const now = new Date()

    const newJob = new Job({
      title: fields.title,
      uuid: UUID,
      psf_file: files.psf_file.originalFilename,
      crd_file: files.crd_file.originalFilename,
      const_inp_file: files.constinp.originalFilename,
      data_file: files.expdata.originalFilename,
      conformational_sampling: fields.num_conf,
      rg_min: fields.rg_min,
      rg_max: fields.rg_max,
      status: 'Submitted',
      time_submitted: now,
      user: user
    })
    await newJob.save()

    logger.info('created new job: %s', newJob.id)

    // add job to BullMQ
    await jobQueue.queueJob({
      type: 'BilboMD',
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })
    logger.info('BullMQ task added to queue with UUID: %s', newJob.uuid)
    res.status(200).json({
      message: 'new BilboMD Job successfully created',
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  })
}

// @desc Update existing job
// @route PATCH /jobs
// @access Private
const updateJobStatus = async (req, res) => {
  const { id, email, status } = req.body

  // Confirm data
  if (!id || !email || !status) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  // Confirm job exists to update
  const job = await Job.findById(id).exec()

  if (!job) {
    return res.status(400).json({ message: 'Job not found' })
  }

  // Check current status
  if (job.status == status) {
    return res
      .status(400)
      .json({ message: `nothing to do - status already ${job.status}` })
  }

  if (job.status == status) {
    return res.status(400).json({ message: 'nothing to do' })
  }

  // Go ahead and update status
  job.status = status

  const updatedJob = await job.save()

  res.json(`'${updatedJob.title}' updated`)
}

// @desc Delete a job
// @route DELETE /jobs
// @access Private
const deleteJob = async (req, res) => {
  const { id } = req.body

  // Confirm that client sent id
  if (!id) {
    return res.status(400).json({ message: 'Job ID required' })
  }

  // Confirm job exists to delete
  const job = await Job.findById(id).exec()

  if (!job) {
    return res.status(400).json({ message: 'Job not found' })
  }

  // Delete from MongoDB
  const result = await job.deleteOne()

  // Remove from disk . Thank you ChatGPT!
  const jobDir = path.join(uploadFolder, job.uuid)

  try {
    // Check if the directory exists
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      return res.status(404).send('Directory not found on disk')
    }
    // Recursively delete the directory
    await fs.remove(jobDir)
  } catch (error) {
    logger.error('Error deleting directory %s', error)
    res.status(500).send('Error deleting directory')
  }

  // const reply = `Deleted Job: '${result.title}' with ID ${result._id} deleted`
  const reply =
    'Deleted Job: ' + result.title + 'with ID: ' + result._id + 'UUID: ' + result.uuid

  res.json({ reply })
}

const getJobById = async (req, res) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'Job ID required.' })
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
  }
  res.json(job)
}

const downloadJobResults = async (req, res) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'Job ID required.' })
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
  }
  const resultFile = path.join(process.env.DATA_VOL, job.uuid, 'results.tar.gz')
  try {
    await fs.promises.access(resultFile)
    res.download(resultFile, (err) => {
      if (err) {
        res.status(500).json({
          message: 'Could not download the file . ' + err
        })
      }
    })
  } catch (error) {
    logger.error('No %s available.', resultFile)
    return res.status(500).json({ message: `No ${resultFile} available.` })
  }
}

module.exports = {
  getAllJobs,
  createNewJob,
  updateJobStatus,
  deleteJob,
  getJobById,
  downloadJobResults
}
