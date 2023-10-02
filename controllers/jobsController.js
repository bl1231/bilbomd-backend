const { logger } = require('../middleware/loggers')
const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid')
const spawn = require('child_process').spawn
const { queueJob, getJobByUUID, getPositionOfJob } = require('../queues/jobQueue')
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
      const position = await getPositionOfJob(job.uuid)
      const bullmqJob = await getJobByUUID(job.uuid)
      return {
        ...job,
        username: user?.username,
        position: position,
        bullmq: bullmqJob
      }
    })
  )
  res.json(jobsWithUser)
}

// @desc Create new job
// @route POST /jobs
// @access Private
const createNewJob = async (req, res) => {
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024, //5MB
    uploadDir: uploadFolder
  })

  // create a unique folder for each job submission using UUIDs
  const UUID = uuid()
  const jobDir = path.join(form.uploadDir, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created directory: %s', jobDir)
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create job directory' })
  }

  // As far as I can tell this is the way to keep original filenames
  // form.on('fileBegin', (fieldName, file) => {
  //   file.filepath = path.join(form.uploadDir, UUID, file.originalFilename)
  // })

  // Function to rename and save files with lowercase filenames
  const renameAndSaveFiles = async (files) => {
    // console.log(files)
    const filesPromises = Object.values(files).map(async (file) => {
      const lowercaseFilename = file.originalFilename.toLowerCase()
      const newFilePath = path.join(jobDir, lowercaseFilename)
      await fs.promises.rename(file.filepath, newFilePath)
      return newFilePath
    })

    await Promise.all(filesPromises)
  }

  form.parse(req, async (err, fields, files) => {
    if (err) {
      logger.error('Error parsing files %s', err)
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      })
    }

    try {
      const { email } = fields
      const user = await User.findOne({ email }).exec()
      if (!user) {
        return res.status(401).json({ message: 'No user found with that email' })
      }

      await renameAndSaveFiles(files)

      const newJob = createNewJobObject(fields, files, UUID, user)
      await newJob.save()

      logger.info('Save new job to MongoDB %s', newJob.id)

      const BullId = await queueJob({
        type: 'BilboMD',
        title: newJob.title,
        uuid: newJob.uuid,
        jobid: newJob.id
      })

      logger.info('Bilbomd Job assigned UUID: %s', newJob.uuid)
      logger.info('BilboMD Job assigned BullMQ ID: %s', BullId)

      res.status(200).json({
        message: 'New BilboMD Job successfully created',
        jobid: newJob.id,
        uuid: newJob.uuid
      })
    } catch (err) {
      logger.error('Error creating new job:', err)
      res.status(500).json({ message: 'Failed to create new job' })
    }
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
  // console.log('jobDir:', jobDir)
  try {
    // Check if the directory exists
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      return res.status(404).json({ message: 'Directory not found on disk' })
    }
    // Recursively delete the directory
    await fs.remove(jobDir)
  } catch (error) {
    logger.error('Error deleting directory %s', error)
    res.status(500).send('Error deleting directory')
  }

  // const reply = `Deleted Job: '${result.title}' with ID ${result._id} deleted`
  const reply =
    'Deleted Job: ' + result.title + ' with ID: ' + result._id + ' UUID: ' + result.uuid

  res.status(200).json({ reply })
}

const getJobById = async (req, res) => {
  const jobId = req.params.id

  if (!jobId) {
    return res.status(400).json({ message: 'Job ID required.' })
  }

  try {
    const job = await Job.findOne({ _id: jobId }).exec()

    if (!job) {
      return res.status(404).json({ message: `No job matches ID ${jobId}.` })
    }

    res.status(200).json(job)
  } catch (error) {
    logger.error('Error retrieving job:', error)
    res.status(500).json({ message: 'Failed to retrieve job.' })
  }
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

const createNewJobObject = (fields, files, UUID, user) => {
  const now = new Date()

  // Create an object to store the file information with lowercase filenames
  const fileInformation = {
    psf_file: files.psf_file.originalFilename.toLowerCase(),
    crd_file: files.crd_file.originalFilename.toLowerCase(),
    const_inp_file: files.constinp.originalFilename.toLowerCase(),
    data_file: files.expdata.originalFilename.toLowerCase()
  }

  return new Job({
    title: fields.title,
    uuid: UUID,
    psf_file: fileInformation.psf_file,
    crd_file: fileInformation.crd_file,
    const_inp_file: fileInformation.const_inp_file,
    data_file: fileInformation.data_file,
    conformational_sampling: fields.num_conf,
    rg_min: fields.rg_min,
    rg_max: fields.rg_max,
    status: 'Submitted',
    time_submitted: now,
    user: user
  })
}

const getAutoRg = async (req, res) => {
  // create a unique folder for each autoRg submission using UUIDs
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, 'autorg_uploads', UUID)
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024, //5MB
    uploadDir: jobDir,
    filename: (name, ext, part, form) => {
      logger.info('form from host: %s', form.headers.host)
      if (part.name == 'expdata') return path.join(jobDir, part.name + '.dat')
    }
  })

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created AutoRg directory: %s', jobDir)
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create AutoRg job directory' })
  }

  form.parse(req, async (err, fields) => {
    if (err) {
      logger.error('Error parsing files %s', err)
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      })
    }

    try {
      const { email } = fields
      const user = await User.findOne({ email }).exec()
      if (!user) {
        return res.status(401).json({ message: 'No user found with that email' })
      }

      const autorgResults = await spawnAutoRgCalculator(jobDir)

      logger.info(autorgResults)

      res.status(200).json({
        message: 'AutoRg Success',
        uuid: UUID,
        rg: 20,
        rg_min: 17,
        rg_max: 31
      })
    } catch (error) {
      logger.error('Error calculatign AutoRg', error)
      res.status(500).json({ message: 'Failed to calculate AutoRg', error: error })
    }
  })
}

const spawnAutoRgCalculator = (dir) => {
  const logFile = path.join(dir, 'autoRg.log')
  const errorFile = path.join(dir, 'autoRg_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const autoRg_script = '/app/scripts/autorg.py'
  const args = [autoRg_script, 'expdata.dat']

  return new Promise((resolve, reject) => {
    const autoRg = spawn('python', args, { cwd: dir })
    let autoRg_json = ''
    autoRg.stdout?.on('data', (data) => {
      logger.info('spawnAutoRgCalculator stdout %s', data.toString())
      logStream.write(data.toString())
      autoRg_json += data.toString()
    })
    autoRg.stderr?.on('data', (data) => {
      logger.error('spawnAutoRgCalculator stderr', data.toString())
      console.log(data)
      errorStream.write(data.toString())
    })
    autoRg.on('error', (error) => {
      logger.error('spawnAutoRgCalculator error:', error)
      reject(error)
    })
    autoRg.on('exit', (code) => {
      if (code === 0) {
        try {
          // Parse the stdout data as JSON
          const analysisResults = JSON.parse(autoRg_json)
          logger.info('spawnAutoRgCalculator close success exit code:', code)
          resolve(analysisResults)
        } catch (parseError) {
          logger.error('Error parsing analysis results:', parseError)
          reject(parseError)
        }
      } else {
        logger.error('spawnAutoRgCalculator close error exit code:', code)
        reject(`spawnAutoRgCalculator on close reject`)
      }
    })
  })
}

module.exports = {
  getAllJobs,
  createNewJob,
  updateJobStatus,
  deleteJob,
  getJobById,
  downloadJobResults,
  getAutoRg
}
