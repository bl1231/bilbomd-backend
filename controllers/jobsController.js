const formidable = require('formidable')
const fs = require('fs')
const path = require('path')
const { v4: uuid } = require('uuid')
const emoji = require('node-emoji')
const jobQueue = require('../queues/jobQueue')
const Job = require('../model/Job')
const User = require('../model/User')

const uploadFolder = path.join(process.env.DATA_VOL)

const check = emoji.get('white_check_mark')

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
      // console.log('getAllJobs: ', user)
      return { ...job, username: user?.username }
    })
  )
  res.json(jobsWithUser)
}

// @desc Create new job
// @route POST /jobs
// @access Private
const createNewJob = async (req, res) => {
  console.log(req.headers['Content-Type'])
  console.log(req.headers['content-type'])
  console.log('body:', req.body)

  const form = new formidable.IncomingForm()
  const files = []
  const fields = []
  form.multiples = true
  form.keepExtensions = true
  form.maxFileSize = 500 * 1024 * 1024 //5MB
  form.uploadDir = uploadFolder

  // create a unique folder for each job submission using UUIDs
  const UUID = uuid()

  fs.mkdir(path.join(form.uploadDir, UUID), (err) => {
    if (err) {
      return console.error(err)
    }
    console.log(emoji.get('white_check_mark'), `${UUID} directory created successfully!`)
  })

  // grab all the multi-part formdata and fill our arrays
  form
    .on('field', (fieldName, value) => {
      // Capture the non-file field values here
      console.log(check, 'got field: ', fieldName, 'value: ', value)
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
      console.log(check, 'fileBegin: ', file.originalFilename)
    })
    .on('file', (fieldName, file) => {
      // same as fileBegin, except
      // it is too late to change file.filepath
      // file.hash is available if options.hash was used
      //console.log(fieldName, file);
      files.push({ fieldName, file })
      console.log(check, 'file: ', file.originalFilename)
    })
    .on('progress', (bytesReceived, bytesExpected) => {
      // what do I do in here?
      console.log('tick.....')
    })
    .on('end', () => {
      console.log(check, 'upload done')
    })

  // parse the form
  form.parse(req, async (err, fields, files) => {
    // catch the errors
    if (err) {
      console.log('Error parsing files')
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      })
    }

    console.log(check, 'all fields: ', fields)
    // find the user
    //console.log(fields.email);
    const user = await User.findOne({ email: fields.email }).exec()
    if (!user) return res.sendStatus(401) //Unauthorized

    // create new job in MongoDB
    const newJob = await Job.create({
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
      time_submitted: Date(),
      user: user
    })

    await newJob.save()
    await jobQueue.queueJob({ title: newJob.title, uuid: newJob.uuid, jobid: newJob.id })
    res
      .status(200)
      .json({ message: 'new BilboMD Job successfully created', jobid: newJob.id })
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

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'Job ID required' })
  }

  // Confirm note exists to delete
  const job = await Job.findById(id).exec()

  if (!job) {
    return res.status(400).json({ message: 'Job not found' })
  }

  const result = await job.deleteOne()

  const reply = `Job '${result.title}' with ID ${result._id} deleted`

  res.json(reply)
}

const getJobById = async (req, res) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'Job ID required.' })
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
  }
  res.json(job)
}

module.exports = {
  getAllJobs,
  createNewJob,
  updateJobStatus,
  deleteJob,
  getJobById
}
