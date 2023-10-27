import { logger } from '../middleware/loggers'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { v4 as uuid } from 'uuid'
// import { Date } from 'mongoose'
// const spawn = require('child_process').spawn
import { queueJob, getBullMQJob } from '../queues/jobQueue'
import { Job, BilboMdJob, BilboMdAutoJob } from '../model/Job'

import { User, IUser } from '../model/User'
import { Express, Request, Response } from 'express'
// import { ChildProcess } from 'child_process'
// import { BilboMDJob } from 'types/bilbomd'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

// type AutoRgResults = {
//   rg: number
//   rg_min: number
//   rg_max: number
// }

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
      return res.status(404).json({ message: 'No BilboMD Jobs Found' })
    }
    // logger.info(DBjobs)
    const bilboMDJobs = await Promise.all(
      DBjobs.map(async (mongo) => {
        const user = await User.findById(mongo.user).lean().exec()
        const bullmq = await getBullMQJob(mongo.uuid)
        const bilboMDJobtest = {
          mongo,
          bullmq,
          username: user?.username
          // bullmq: bullmqJob
        }
        // logger.info(bilboMDJob)
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
      { name: 'crd_file', maxCount: 1 },
      { name: 'constinp', maxCount: 1 },
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
        logger.info(`job type in req ${job_type}`)
        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }
        if (!job_type) {
          return res.status(400).json({ message: 'No job type provided' })
        }
        user = foundUser

        if (job_type === 'BilboMD') {
          await handleBilboMDJob(req, res, user, UUID)
        } else if (job_type === 'BilboMDAuto') {
          await handleBilboMDAutoJob(req, res, user, UUID)
        } else {
          // Handle invalid job types or other cases
          res.status(400).json({ message: 'Invalid job type' })
        }
      } catch (error) {
        // Handle any internal errors that occur while processing the uploaded data
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

async function handleBilboMDJob(req: Request, res: Response, user: IUser, UUID: string) {
  const { job_type: jobType } = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  const now = new Date()
  const newJob = new BilboMdJob({
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
    type: 'BilboMD',
    title: newJob.title,
    uuid: newJob.uuid
  })

  logger.info(`${jobType} Job assigned UUID: ${newJob.uuid}`)
  logger.info(`${jobType} Job assigned BullMQ ID: ${BullId}`)
  res.status(200).json({
    message: `New ${jobType} Job successfully created`,
    jobid: newJob.id,
    uuid: newJob.uuid
  })
}

async function handleBilboMDAutoJob(
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) {
  const { job_type: jobType } = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  const now = new Date()
  const newJob = new BilboMdAutoJob({
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
    type: 'BilboMD',
    title: newJob.title,
    uuid: newJob.uuid
  })

  logger.info(`${jobType} Job assigned UUID: ${newJob.uuid}`)
  logger.info(`${jobType} Job assigned BullMQ ID: ${BullId}`)
  res.status(200).json({
    message: `New ${jobType} Job successfully created`,
    jobid: newJob.id,
    uuid: newJob.uuid
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

// const createNewJobObject = (fields, files, UUID: string, user: string) => {
//   const now = new Date()

//   // Create an object to store the file information with lowercase filenames
//   const fileInformation = {
//     psf_file: files.psf_file?.originalFilename?.toLowerCase(),
//     crd_file: files.crd_file?.originalFilename?.toLowerCase(),
//     const_inp_file: files.constinp?.originalFilename?.toLowerCase(),
//     data_file: files.expdata?.originalFilename?.toLowerCase()
//   }

//   return new BilboMdJob({
//     title: fields.title,
//     uuid: UUID,
//     psf_file: fileInformation.psf_file,
//     crd_file: fileInformation.crd_file,
//     const_inp_file: fileInformation.const_inp_file,
//     data_file: fileInformation.data_file,
//     conformational_sampling: fields.num_conf,
//     rg_min: fields.rg_min,
//     rg_max: fields.rg_max,
//     status: 'Submitted',
//     time_submitted: now,
//     user: user
//   })
// }

// const createNewAutoJobObject = (
//   fields: Record<string, formidable.Fields>,
//   files: Record<string, formidable.Files>,
//   UUID: string,
//   user: string
// ) => {
//   const now = new Date()
//   // console.log(files.psf_file)
//   // Create an object to store the file information with lowercase filenames
//   const fileInformation = {
//     psf_file: files.psf_file.originalFilename.toLowerCase(),
//     crd_file: files.crd_file.originalFilename.toLowerCase(),
//     pae_file: files.pae_file.originalFilename.toLowerCase(),
//     dat_file: files.dat_file.originalFilename.toLowerCase()
//   }

//   return new BilboMdAutoJob({
//     title: fields.title,
//     uuid: UUID,
//     psf_file: fileInformation.psf_file,
//     crd_file: fileInformation.crd_file,
//     pae_file: fileInformation.pae_file,
//     data_file: fileInformation.dat_file,
//     status: 'Submitted',
//     time_submitted: now,
//     user: user
//   })
// }

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
const getAutoRg = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, 'autorg_uploads', UUID)
  console.log(jobDir)
  console.log(req)
  // const form = formidable({
  //   keepExtensions: true,
  //   allowEmptyFiles: false,
  //   maxFileSize: 250 * 1024 * 1024, //250MB
  //   uploadDir: jobDir
  // })

  // try {
  //   await fs.mkdir(jobDir, { recursive: true })
  //   logger.info('Create temporary AutoRg directory: %s', jobDir)
  // } catch (error) {
  //   logger.error(error)
  //   return res.status(500).json({ message: 'Failed to create AutoRg job directory' })
  // }

  // // const saveFile = async (files: Record<string, formidable.File[]>, jobDir: string) => {
  // //   const promises: Promise<void>[] = []

  // //   // Iterate through each field name
  // //   for (const fieldName in files) {
  // //     const fileArray = files[fieldName]

  // //     for (const file of fileArray) {
  // //       const newFilePath = path.join(jobDir, 'expdata.dat')
  // //       const promise = fs.promises.rename(file.filepath, newFilePath)
  // //       promises.push(promise)
  // //     }
  // //   }

  // //   // Wait for all promises to resolve
  // //   await Promise.all(promises)
  // // }

  // form.parse(req, async (err, fields, files) => {
  //   if (err) {
  //     logger.error('Error parsing files %s', err)
  //     return res.status(400).json({
  //       status: 'Fail',
  //       message: 'There was a problem parsing the uploaded files',
  //       error: err
  //     })
  //   }

  //   try {
  //     const { email } = fields
  //     const user = await User.findOne({ email }).exec()
  //     if (!user) {
  //       return res.status(401).json({ message: 'No user found with that email' })
  //     }
  //     console.log(files)
  //     // await saveFile(files, jobDir)

  //     const autorgResults: AutoRgResults = await spawnAutoRgCalculator(jobDir)

  //     logger.info('autorgResults: %s', autorgResults)

  //     res.status(200).json({
  //       message: 'AutoRg Success',
  //       uuid: UUID,
  //       rg: autorgResults.rg,
  //       rg_min: autorgResults.rg_min,
  //       rg_max: autorgResults.rg_max
  //     })
  //     // remove the uploaded files.
  //     // comment out for debugging I suppose.
  //     try {
  //       await fs.remove(jobDir)
  //       logger.info(`Deleted upload folder: ${jobDir}`)
  //     } catch (error) {
  //       logger.error(`Error deleting upload folder: ${jobDir}`, error)
  //     }
  //   } catch (error) {
  //     logger.error('Error calculatign AutoRg', error)
  //     res.status(500).json({ message: 'Failed to calculate AutoRg', error: error })
  //   }
  // })
  res.json({ m: 'ok' })
}

// const spawnAutoRgCalculator = async (dir: string): Promise<AutoRgResults> => {
//   const logFile = path.join(dir, 'autoRg.log')
//   const errorFile = path.join(dir, 'autoRg_error.log')
//   const logStream = fs.createWriteStream(logFile)
//   const errorStream = fs.createWriteStream(errorFile)
//   const autoRg_script = '/app/scripts/autorg.py'
//   const args = [autoRg_script, 'expdata.dat']

//   return new Promise<AutoRgResults>((resolve, reject) => {
//     const autoRg: ChildProcess = spawn('python', args, { cwd: dir })
//     let autoRg_json = ''
//     autoRg.stdout?.on('data', (data: Buffer) => {
//       logger.info('spawnAutoRgCalculator stdout %s', data.toString())
//       logStream.write(data.toString())
//       autoRg_json += data.toString()
//     })
//     autoRg.stderr?.on('data', (data: Buffer) => {
//       logger.error('spawnAutoRgCalculator stderr', data.toString())
//       console.log(data)
//       errorStream.write(data.toString())
//     })
//     autoRg.on('error', (error) => {
//       logger.error('spawnAutoRgCalculator error:', error)
//       reject(error)
//     })
//     autoRg.on('exit', (code) => {
//       if (code === 0) {
//         try {
//           // Parse the stdout data as JSON
//           const analysisResults = JSON.parse(autoRg_json)
//           logger.info('spawnAutoRgCalculator close success exit code:', code)
//           resolve(analysisResults)
//         } catch (parseError) {
//           logger.error('Error parsing analysis results:', parseError)
//           reject(parseError)
//         }
//       } else {
//         logger.error('spawnAutoRgCalculator close error exit code:', code)
//         reject(`spawnAutoRgCalculator on close reject`)
//       }
//     })
//   })
// }

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
