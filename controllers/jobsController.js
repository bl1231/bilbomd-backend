const { logger } = require('../middleware/loggers')
const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid')
const spawn = require('child_process').spawn
const { queueJob, getJobByUUID, getPositionOfJob } = require('../queues/jobQueue')
const { Job, BilboMdJob, BilboMdAutoJob } = require('../model/Job')
const User = require('../model/User')

const uploadFolder = path.join(process.env.DATA_VOL)

/**
 * @openapi
 * /jobs:
 *   get:
 *     summary: Get All Jobs
 *     description: Retrieve a list of all jobs.
 *     tags:
 *       - Job Management
 *     responses:
 *       200:
 *         description: List of jobs retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *       400:
 *         description: Bad request. No jobs found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
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

/**
 * @openapi
 * /jobs:
 *   post:
 *     summary: Create a new job
 *     description: Create a new job submission.
 *     tags:
 *       - Job Management
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of files to be uploaded.
 *     responses:
 *       200:
 *         description: New BilboMD Job successfully created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A success message.
 *                 jobid:
 *                   type: string
 *                   description: The ID of the newly created job.
 *                 uuid:
 *                   type: string
 *                   description: The UUID associated with the job.
 *       400:
 *         description: There was a problem parsing the uploaded files.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the request (Fail).
 *                 message:
 *                   type: string
 *                   description: Error message.
 *                 error:
 *                   type: string
 *                   description: Detailed error description.
 *       401:
 *         description: No user found with that email.
 *       500:
 *         description: Internal server error.
 */
const createNewJob = async (req, res) => {
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, //100MB
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

      let jobType
      let newJob

      if (req.originalUrl === '/v1/jobs') {
        jobType = 'BilboMD'
        logger.info('create new BilboMD Job')
        newJob = createNewJobObject(fields, files, UUID, user)
      } else if (req.originalUrl === '/v1/jobs/bilbomd-auto') {
        logger.info('create new BilboMD Auto Job')
        jobType = 'BilboMDAuto'
        newJob = createNewAutoJobObject(fields, files, UUID, user)
      } else {
        return res
          .status(400)
          .json({ message: 'Invalid job type', path: req.originalUrl })
      }

      await newJob.save()
      logger.info('Saved new job to MongoDB %s', newJob.id)

      const BullId = await queueJob({
        type: jobType,
        title: newJob.title,
        uuid: newJob.uuid,
        jobid: newJob.id
      })

      logger.info(`${jobType} Job assigned UUID: %s`, newJob.uuid)
      logger.info(`${jobType} Job assigned BullMQ ID: %s`, BullId)

      res.status(200).json({
        message: `New ${jobType} Job successfully created`,
        jobid: newJob.id,
        uuid: newJob.uuid
      })
    } catch (err) {
      logger.error('Error creating new job:', err)
      res.status(500).json({ message: 'Failed to create new job' })
    }
  })
}

/**
 * @openapi
 * /jobs:
 *   patch:
 *     summary: Update job status
 *     description: Update the status of a job.
 *     tags:
 *       - Job Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the job to update.
 *               email:
 *                 type: string
 *                 description: The email address associated with the job.
 *               status:
 *                 type: string
 *                 description: The new status for the job.
 *     responses:
 *       200:
 *         description: Job status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A success message indicating the job title that was updated.
 *       400:
 *         description: All fields are required, or job not found, or nothing to do.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 *       500:
 *         description: Internal server error.
 */
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

/**
 * @openapi
 * /jobs/{id}:
 *   delete:
 *     summary: Delete a Job by ID
 *     description: Delete a job by its unique identifier.
 *     tags:
 *       - Job Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the job to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *                   description: A success message indicating the deleted job.
 *       400:
 *         description: Bad Request. Invalid or missing job ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: An error message indicating the invalid or missing ID.
 *       404:
 *         description: Not Found. The job with the specified ID was not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: An error message indicating the job was not found.
 *       500:
 *         description: Internal Server Error. Failed to delete the job.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: An error message indicating the failure to delete the job.
 */
const deleteJob = async (req, res) => {
  const { id } = req.params

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

/**
 * @openapi
 * /jobs/{id}:
 *   get:
 *     summary: Get a job by its ID.
 *     tags:
 *       - Job Management
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the job to retrieve.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       400:
 *         description: Bad request. Job ID required.
 *       404:
 *         description: No job matches the provided ID.
 *       500:
 *         description: Internal server error.
 */
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

/**
 * @openapi
 * /jobs/{id}/download:
 *   get:
 *     summary: Download job results by its ID.
 *     tags:
 *       - Job Management
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the job to download results from.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Job results downloaded successfully.
 *       '204':
 *         description: No job matches the provided ID.
 *       '400':
 *         description: Bad request. Job ID required.
 *       '500':
 *         description: Internal server error.
 */
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

  return new BilboMdJob({
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

const createNewAutoJobObject = (fields, files, UUID, user) => {
  const now = new Date()
  // console.log(files.psf_file)
  // Create an object to store the file information with lowercase filenames
  const fileInformation = {
    psf_file: files.psf_file.originalFilename.toLowerCase(),
    crd_file: files.crd_file.originalFilename.toLowerCase(),
    pae_file: files.pae_file.originalFilename.toLowerCase(),
    dat_file: files.dat_file.originalFilename.toLowerCase()
  }

  return new BilboMdAutoJob({
    title: fields.title,
    uuid: UUID,
    psf_file: fileInformation.psf_file,
    crd_file: fileInformation.crd_file,
    pae_file: fileInformation.pae_file,
    data_file: fileInformation.dat_file,
    status: 'Submitted',
    time_submitted: now,
    user: user
  })
}

/**
 * @openapi
 * /autorg:
 *   post:
 *     summary: Calculate AutoRg for uploaded data.
 *     tags:
 *       - Utilities
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The data file to calculate AutoRg from.
 *     responses:
 *       200:
 *         description: AutoRg calculation successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A success message.
 *                 uuid:
 *                   type: string
 *                   description: The UUID of the AutoRg calculation.
 *                 rg:
 *                   type: number
 *                   description: The calculated Rg value.
 *                 rg_min:
 *                   type: number
 *                   description: The minimum Rg value.
 *                 rg_max:
 *                   type: number
 *                   description: The maximum Rg value.
 *       400:
 *         description: Bad request. Missing email or file.
 *       401:
 *         description: Unauthorized. No user found with the provided email.
 *       500:
 *         description: Internal server error.
 */
const getAutoRg = async (req, res) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, 'autorg_uploads', UUID)
  const form = formidable({
    keepExtensions: true,
    allowEmptyFiles: false,
    maxFileSize: 250 * 1024 * 1024, //250MB
    uploadDir: jobDir
  })

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created AutoRg directory: %s', jobDir)
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create AutoRg job directory' })
  }

  const saveFile = async (files) => {
    const filesPromises = Object.values(files).map(async (file) => {
      const newFilePath = path.join(jobDir, 'expdata.dat')
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

      await saveFile(files)

      const autorgResults = await spawnAutoRgCalculator(jobDir)

      logger.info(autorgResults)

      res.status(200).json({
        message: 'AutoRg Success',
        uuid: UUID,
        rg: autorgResults.rg,
        rg_min: autorgResults.rg_min,
        rg_max: autorgResults.rg_max
      })
      // remove the uploaded files.
      // comment out for debugging I suppose.
      try {
        await fs.remove(jobDir)
        logger.info(`Deleted upload folder: ${jobDir}`)
      } catch (error) {
        logger.error(`Error deleting upload folder: ${jobDir}`, error)
      }
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
