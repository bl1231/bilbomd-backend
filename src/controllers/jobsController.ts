import { logger } from '../middleware/loggers'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { v4 as uuid } from 'uuid'
const spawn = require('child_process').spawn
import { queueJob, getBullMQJob } from '../queues/bilbomd'
import { queueScoperJob } from '../queues/scoper'
import {
  Job,
  BilboMdJob,
  IBilboMDJob,
  BilboMdAutoJob,
  IBilboMDAutoJob,
  BilboMdScoperJob,
  IBilboMDScoperJob
} from '../model/Job'

import { User, IUser } from '../model/User'
import { Express, Request, Response } from 'express'
import { ChildProcess } from 'child_process'
// import { BilboMDJob } from 'types/bilbomd'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

type AutoRgResults = {
  rg: number
  rg_min: number
  rg_max: number
}

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
const getAllJobs = async (req: Request, res: Response) => {
  try {
    const DBjobs = await Job.find().lean()

    if (!DBjobs?.length) {
      return res.status(204).json({})
    }

    const bilboMDJobs = await Promise.all(
      DBjobs.map(async (mongo) => {
        const user = await User.findById(mongo.user).lean().exec()
        const bullmq = await getBullMQJob(mongo.uuid)
        const bilboMDJobtest = {
          mongo,
          bullmq,
          username: user?.username
        }
        return bilboMDJobtest
      })
    )
    res.status(200).json(bilboMDJobs)
  } catch (error) {
    logger.error(error)
    console.log(error)
    res.status(500).json({ message: 'Internal Server Error - getAllJobs' })
  }
}

const createNewJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)
  let user: IUser

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created directory: %s', jobDir)

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, jobDir)
      },
      filename: function (req, file, cb) {
        cb(null, file.originalname.toLowerCase())
      }
    })

    const upload = multer({ storage: storage })

    // Use `upload.fields()` to handle multiple files and fields
    upload.fields([
      { name: 'psf_file', maxCount: 1 },
      { name: 'pdb_file', maxCount: 1 },
      { name: 'crd_file', maxCount: 1 },
      { name: 'constinp', maxCount: 1 },
      { name: 'const_file', maxCount: 1 },
      { name: 'inp_file', maxCount: 1 },
      { name: 'expdata', maxCount: 1 },
      { name: 'dat_file', maxCount: 1 },
      { name: 'pae_file', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        return res.status(500).json({ message: 'Failed to upload one or more files' })
      }

      try {
        const { email, job_type } = req.body
        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }
        if (!job_type) {
          return res.status(400).json({ message: 'No job type provided' })
        }
        user = foundUser

        if (job_type === 'BilboMD') {
          logger.info('about to handleBilboMDJob')
          await handleBilboMDJob(req, res, user, UUID)
        } else if (job_type === 'BilboMDAuto') {
          logger.info('about to handleBilboMDAutoJob')
          await handleBilboMDAutoJob(req, res, user, UUID)
        } else if (job_type === 'BilboMDScoper') {
          logger.info('about to handleBilboMDScoperJob')
          await handleBilboMDScoperJob(req, res, user, UUID)
        } else {
          res.status(400).json({ message: 'Invalid job type' })
        }
      } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Internal server error' })
      }
    })
  } catch (error) {
    // Handle errors related to directory creation
    logger.error(error)
    res.status(500).json({ message: 'Failed to create job directory' })
  }
}

const handleBilboMDJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const { job_type: jobType } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    // console.log('Received files:', files)
    const now = new Date()
    const newJob: IBilboMDJob = new BilboMdJob({
      title: req.body.title,
      uuid: UUID,
      psf_file: files['psf_file'][0].originalname.toLowerCase(),
      crd_file: files['crd_file'][0].originalname.toLowerCase(),
      const_inp_file: files['constinp'][0].originalname.toLowerCase(),
      data_file: files['expdata'][0].originalname.toLowerCase(),
      conformational_sampling: req.body.num_conf,
      rg_min: req.body.rg_min,
      rg_max: req.body.rg_max,
      status: 'Submitted',
      time_submitted: now,
      user: user
    })
    await newJob.save()
    logger.info(`${jobType} Job saved to MongoDB: ${newJob.id}`)
    const BullId = await queueJob({
      type: jobType,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${jobType} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${jobType} Job assigned BullMQ ID: ${BullId}`)
    res.status(200).json({
      message: `New ${jobType} Job successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ message: 'Failed to create handleBilboMDJob job' })
  }
}

const handleBilboMDAutoJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const { job_type: jobType } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(
      `CRD File: ${
        files['crd_file'] ? files['crd_file'][0].originalname.toLowerCase() : 'Not Found'
      }`
    )
    const now = new Date()
    // logger.info(`now:  ${now.toDateString()}`)
    const newJob: IBilboMDAutoJob = new BilboMdAutoJob({
      title: req.body.title,
      uuid: UUID,
      psf_file: files['psf_file'][0].originalname.toLowerCase(),
      crd_file: files['crd_file'][0].originalname.toLowerCase(),
      pae_file: files['pae_file'][0].originalname.toLowerCase(),
      data_file: files['dat_file'][0].originalname.toLowerCase(),
      conformational_sampling: 3,
      status: 'Submitted',
      time_submitted: now,
      user: user
    })
    // logger.info(`handleBilboMDAutoJob newJob: ${newJob}`)

    // Save the job to the database
    await newJob.save()
    logger.info(`${jobType} Job saved to MongoDB: ${newJob.id}`)

    // Queue the job
    const BullId = await queueJob({
      type: jobType,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${jobType} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${jobType} Job assigned BullMQ ID: ${BullId}`)
    res.status(200).json({
      message: `New ${jobType} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    // Handle any errors and send an appropriate response to the client
    logger.error(error)
    res.status(500).json({ message: 'Failed to create handleBilboMDAutoJob job' })
  }
}

const handleBilboMDScoperJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const { job_type: jobType } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const now = new Date()
    // logger.info(`now:  ${now.toDateString()}`)
    const newJob: IBilboMDScoperJob = new BilboMdScoperJob({
      title: req.body.title,
      uuid: UUID,
      pdb_file: files['pdb_file'][0].originalname.toLowerCase(),
      data_file: files['dat_file'][0].originalname.toLowerCase(),
      status: 'Submitted',
      time_submitted: now,
      user: user
    })
    // logger.info(`in handleBilboMDScoperJob: ${newJob}`)
    // Save the job to the database
    await newJob.save()
    logger.info(`${jobType} Job saved to MongoDB: ${newJob.id}`)

    // Queue the job
    const BullId = await queueScoperJob({
      type: jobType,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${jobType} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${jobType} Job assigned BullMQ ID: ${BullId}`)
    res.status(200).json({
      message: `New ${jobType} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    // Log more detailed information about the error
    if (error instanceof Error) {
      logger.error('Error in handleBilboMDScoperJob:', error.message)
      logger.error('Stack Trace:', error.stack)
    } else {
      logger.error('Non-standard error object:', error)
    }
    res.status(500).json({ message: 'Failed to create handleBilboMDScoperJob job' })
  }
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
const updateJobStatus = async (req: Request, res: Response) => {
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
const deleteJob = async (req: Request, res: Response) => {
  const { id } = req.params

  // Confirm that client sent id
  if (!id) {
    return res.status(400).json({ message: 'Job ID required' })
  }

  // Find the job to delete
  const job = await Job.findById(id).exec()

  if (!job) {
    return res.status(400).json({ message: 'Job not found' })
  }

  // Delete the job from MongoDB
  const deleteResult = await job.deleteOne()

  // Check if a document was actually deleted
  if (deleteResult.deletedCount === 0) {
    return res.status(404).json({ message: 'No job was deleted' })
  }

  // Remove from disk
  const jobDir = path.join(uploadFolder, job.uuid)
  try {
    // Check if the directory exists and remove it
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      return res.status(404).json({ message: 'Directory not found on disk' })
    }
    await fs.remove(jobDir)
  } catch (error) {
    logger.error('Error deleting directory %s', error)
    res.status(500).send('Error deleting directory')
  }

  // Create response message
  const reply = `Deleted Job: '${job.title}' with ID ${job._id} and UUID: ${job.uuid}`

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
const getJobById = async (req: Request, res: Response) => {
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
const downloadJobResults = async (req: Request, res: Response) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'Job ID required.' })
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
  }
  const resultFile = path.join(uploadFolder, job.uuid, 'results.tar.gz')
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

const getLogForStep = async (req: Request, res: Response) => {
  if (!req?.params?.id) return res.status(400).json({ message: 'Job ID required.' })
  // Check if req.params.id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid Job ID format.' })
  }
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
  }
  const step = req.query.step
  let logFile: string = ''
  switch (step) {
    case 'minimize':
      logFile = path.join(uploadFolder, job.uuid, 'minimize.out')
      break
    case 'heat':
      logFile = path.join(uploadFolder, job.uuid, 'heat.out')
      break
    default:
      res.status(200).json({
        logContent: `Cannot retrieve error logs for ${step} step.\n please contact SIBYLS staff\n`
      })
  }

  fs.readFile(logFile, 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occurred while reading the file
      return res.status(500).json({ message: 'Error reading log file' })
    }

    // Send the log file content in a JSON response
    res.status(200).json({ logContent: data })
  })
}

const getAutoRg = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, 'autorg_uploads', UUID)
  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Create temporary AutoRg directory: %s', jobDir)

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, jobDir)
      },
      filename: function (req, file, cb) {
        cb(null, 'expdata.dat')
      }
    })
    const upload = multer({ storage: storage })
    upload.single('expdata')(req, res, async (err) => {
      if (err) {
        logger.error(err)
        return res.status(500).json({ message: 'Failed to upload expdata file' })
      }

      try {
        const { email } = req.body
        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }

        const autorgResults: AutoRgResults = await spawnAutoRgCalculator(jobDir)
        logger.info(`autorgResults: ${JSON.stringify(autorgResults)}`)

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
          logger.error(`Error deleting upload folder: ${jobDir} ERROR - ${error}`)
        }
      } catch (error) {
        logger.error('Error calculatign AutoRg', error)
        res.status(500).json({ message: 'Failed to calculate AutoRg', error: error })
      }
    })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ message: 'Failed to create AutoRg job directory' })
  }
}

const spawnAutoRgCalculator = async (dir: string): Promise<AutoRgResults> => {
  const logFile = path.join(dir, 'autoRg.log')
  const errorFile = path.join(dir, 'autoRg_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const autoRg_script = '/app/scripts/autorg.py'
  const args = [autoRg_script, 'expdata.dat']

  return new Promise<AutoRgResults>((resolve, reject) => {
    const autoRg: ChildProcess = spawn('python', args, { cwd: dir })
    let autoRg_json = ''
    autoRg.stdout?.on('data', (data: Buffer) => {
      const dataString = data.toString().trim()
      logger.info(`spawnAutoRgCalculator stdout: ${dataString}`)
      logStream.write(dataString)
      autoRg_json += dataString
    })
    autoRg.stderr?.on('data', (data: Buffer) => {
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
          logger.info(`spawnAutoRgCalculator close success exit code: ${code}`)
          resolve(analysisResults)
        } catch (parseError) {
          logger.error(`Error parsing analysis results: ${parseError}`)
          reject(parseError)
        }
      } else {
        logger.error(`spawnAutoRgCalculator close error exit code: ${code}`)
        reject(`spawnAutoRgCalculator on close reject`)
      }
    })
  })
}

export {
  getAllJobs,
  createNewJob,
  updateJobStatus,
  deleteJob,
  getJobById,
  downloadJobResults,
  getLogForStep,
  getAutoRg
}
