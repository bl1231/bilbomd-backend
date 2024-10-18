import { logger } from '../middleware/loggers.js'
import { config } from '../config/config.js'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs-extra'
import os from 'os'
import readline from 'readline'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { spawn } from 'child_process'
import { queueJob, getBullMQJob } from '../queues/bilbomd.js'
import { queueScoperJob, getBullMQScoperJob } from '../queues/scoper.js'
import {
  queueJob as queuePdb2CrdJob,
  waitForJobCompletion,
  pdb2crdQueueEvents
} from '../queues/pdb2crd.js'
import {
  Job,
  IJob,
  BilboMdPDBJob,
  IBilboMDPDBJob,
  BilboMdCRDJob,
  IBilboMDCRDJob,
  BilboMdAutoJob,
  IBilboMDAutoJob,
  BilboMdScoperJob,
  IBilboMDScoperJob,
  IBilboMDAlphaFoldJob,
  IBilboMDSANSJob
} from '@bl1231/bilbomd-mongodb-schema'
import { User, IUser } from '@bl1231/bilbomd-mongodb-schema'
import { Express, Request, Response } from 'express'
import { ChildProcess } from 'child_process'
import { BilboMDScoperSteps, BilboMDSteps } from '../types/bilbomd.js'
import { BilboMDJob, BilboMDBullMQ } from '../types/bilbomd.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

type AutoRgResults = {
  rg: number
  rg_min: number
  rg_max: number
}

const getAllJobs = async (req: Request, res: Response) => {
  try {
    const username = req.user as string
    const roles = req.roles as string[]

    // Determine if the user is an admin or manager based on their roles
    const isAdmin = roles.includes('Admin')
    const isManager = roles.includes('Manager')

    let jobFilter = {}
    if (!isAdmin && !isManager) {
      logger.info(`User ${username} is not an Admin or Manager - filtering by username`)
      const user = await User.findOne({ username }).lean()

      if (!user) {
        res.status(404).json({ message: 'User not found' })
        return
      }

      // Use the user's ObjectId to filter jobs
      jobFilter = { user: user._id }
    }

    // const DBjobs: Array<IJob> = await Job.find().lean()
    const DBjobs = (await Job.find(jobFilter).lean()) as IJob[]

    if (!DBjobs?.length) {
      logger.info('No jobs found')
      res.status(204).json({ message: 'No jobs found' })
      return
    }

    const bilboMDJobs = await Promise.all(
      DBjobs.map(async (mongo) => {
        const user = await User.findById(mongo.user).lean().exec()

        let bullmq
        if (['BilboMd', 'BilboMdAuto'].includes(mongo.__t)) {
          bullmq = await getBullMQJob(mongo.uuid)
        } else if (mongo.__t === 'BilboMdScoper') {
          bullmq = await getBullMQScoperJob(mongo.uuid)
        }

        const bilboMDJobtest = {
          mongo,
          bullmq,
          username: user?.username
        }
        // logger.info(bilboMDJobtest)
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
    logger.info(`Created directory: ${jobDir}`)

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
      { name: 'bilbomd_mode', maxCount: 1 },
      { name: 'psf_file', maxCount: 1 },
      { name: 'pdb_file', maxCount: 1 },
      { name: 'crd_file', maxCount: 1 },
      { name: 'constinp', maxCount: 1 },
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
        const { email, bilbomd_mode } = req.body
        const foundUser = await User.findOne({ email }).exec()

        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }

        if (!bilbomd_mode) {
          return res.status(400).json({ message: 'No job type provided' })
        }

        user = foundUser

        if (bilbomd_mode === 'pdb' || bilbomd_mode === 'crd_psf') {
          logger.info(`about to handleBilboMDJob ${req.body.bilbomd_mode}`)
          await handleBilboMDJob(req, res, user, UUID, jobDir)
        } else if (bilbomd_mode === 'auto') {
          logger.info('about to handleBilboMDAutoJob')
          await handleBilboMDAutoJob(req, res, user, UUID)
        } else if (bilbomd_mode === 'scoper') {
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
  UUID: string,
  jobDir: string
) => {
  try {
    const { bilbomd_mode: bilbomdMode } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(`bilbomdMode: ${bilbomdMode}`)
    logger.info(`title: ${req.body.title}`)

    const constInpFile = files['constinp'][0].originalname.toLowerCase()
    const dataFile = files['expdata'][0].originalname.toLowerCase()

    // Rename the original constinp file to create a backup
    const constInpFilePath = path.join(jobDir, constInpFile)
    const constInpOrigFilePath = path.join(jobDir, `${constInpFile}.orig`)

    await fs.copyFile(constInpFilePath, constInpOrigFilePath)

    // Sanitize the uploaded file (constInpFilePath)
    await sanitizeConstInpFile(constInpFilePath)

    const jobData = {
      title: req.body.title,
      uuid: UUID,
      const_inp_file: constInpFile,
      data_file: dataFile,
      conformational_sampling: req.body.num_conf,
      rg_min: req.body.rg_min,
      rg_max: req.body.rg_max,
      status: 'Submitted',
      time_submitted: new Date(),
      user: user,
      steps: {
        pdb2crd: {},
        minimize: {},
        initfoxs: {},
        heat: {},
        md: {},
        dcd2pdb: {},
        foxs: {},
        multifoxs: {},
        results: {},
        email: {}
      }
    }

    let newJob: IBilboMDPDBJob | IBilboMDCRDJob | undefined

    if (bilbomdMode === 'crd_psf') {
      const psfFile = files['psf_file']
        ? files['psf_file'][0].originalname.toLowerCase()
        : ''
      const crdFile = files['crd_file']
        ? files['crd_file'][0].originalname.toLowerCase()
        : ''
      // Add specific fields for CRD/PSF mode
      Object.assign(jobData, { psf_file: psfFile, crd_file: crdFile })
      newJob = new BilboMdCRDJob(jobData)
    } else if (bilbomdMode === 'pdb') {
      const pdbFile = files['pdb_file']
        ? files['pdb_file'][0].originalname.toLowerCase()
        : ''
      // Add specific field for PDB mode
      Object.assign(jobData, { pdb_file: pdbFile })
      newJob = new BilboMdPDBJob(jobData)
    }

    // Ensure newJob is defined before proceeding
    if (!newJob) {
      // Handle the case where newJob wasn't set due to an unsupported bilbomdMode
      logger.error(`Unsupported bilbomd_mode: ${bilbomdMode}`)
      return res.status(400).json({ message: 'Invalid bilbomd_mode specified' })
    }
    logger.info(newJob)
    // Save the job to MongoDB
    await newJob.save()
    logger.info(`BilboMD-${bilbomdMode} Job saved to MongoDB: ${newJob.id}`)

    // Write Job params for use by NERSC job script.
    await writeJobParams(newJob.id)

    // Queue the job
    const BullId = await queueJob({
      type: bilbomdMode,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${bilbomdMode} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${bilbomdMode} Job assigned BullMQ ID: ${BullId}`)

    res.status(200).json({
      message: `New ${bilbomdMode} Job successfully created`,
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
    const { bilbomd_mode: bilbomdMode } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const pdbFileName =
      files['pdb_file'] && files['pdb_file'][0]
        ? files['pdb_file'][0].originalname.toLowerCase()
        : 'missing.pdb'
    const paeFileName =
      files['pae_file'] && files['pae_file'][0]
        ? files['pae_file'][0].originalname.toLowerCase()
        : 'missing.json'
    const datFileName =
      files['dat_file'] && files['dat_file'][0]
        ? files['dat_file'][0].originalname.toLowerCase()
        : 'missing.json'
    logger.info(`PDB File: ${pdbFileName}`)
    logger.info(`PAE File: ${paeFileName}`)

    const now = new Date()

    const newJob: IBilboMDAutoJob = new BilboMdAutoJob({
      title: req.body.title,
      uuid: UUID,
      pdb_file: pdbFileName,
      pae_file: paeFileName,
      data_file: datFileName,
      conformational_sampling: 3,
      status: 'Submitted',
      time_submitted: now,
      user: user,
      steps: {
        pdb2crd: {},
        pae: {},
        autorg: {},
        minimize: {},
        initfoxs: {},
        heat: {},
        md: {},
        dcd2pdb: {},
        foxs: {},
        multifoxs: {},
        results: {},
        email: {}
      }
    })

    // Save the job to the database
    await newJob.save()
    logger.info(`${bilbomdMode} Job saved to MongoDB: ${newJob.id}`)

    // Write Job params for use by NERSC job script.
    await writeJobParams(newJob.id)

    // ---------------------------------------------------------- //
    // Convert PDB to PSF and CRD
    if (!config.runOnNERSC) {
      const Pdb2CrdBullId = await queuePdb2CrdJob({
        type: 'Pdb2Crd',
        title: 'convert PDB to CRD',
        uuid: UUID,
        pdb_file: pdbFileName,
        pae_power: '2.0'
      })
      logger.info(`Pdb2Crd Job assigned UUID: ${UUID}`)
      logger.info(`Pdb2Crd Job assigned BullMQ ID: ${Pdb2CrdBullId}`)

      // Need to wait here until the BullMQ job is finished
      await waitForJobCompletion(Pdb2CrdBullId, pdb2crdQueueEvents)
      logger.info('Pdb2Crd completed.')
    }
    // ---------------------------------------------------------- //

    // Add PSF and CRD files to Mongo entry
    newJob.psf_file = 'bilbomd_pdb2crd.psf'
    newJob.crd_file = 'bilbomd_pdb2crd.crd'
    await newJob.save()

    // Queue the job
    const BullId = await queueJob({
      type: bilbomdMode,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${bilbomdMode} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${bilbomdMode} Job assigned BullMQ ID: ${BullId}`)

    res.status(200).json({
      message: `New ${bilbomdMode} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
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
    const { bilbomd_mode: bilbomdMode } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(
      `PDB File: ${
        files['pdb_file'] ? files['pdb_file'][0].originalname.toLowerCase() : 'Not Found'
      }`
    )
    logger.info(
      `DAT File: ${
        files['dat_file'] ? files['dat_file'][0].originalname.toLowerCase() : 'Not Found'
      }`
    )
    const now = new Date()
    // logger.info(`now:  ${now.toDateString()}`)
    const newJob: IBilboMDScoperJob = new BilboMdScoperJob({
      title: req.body.title,
      uuid: UUID,
      pdb_file: files['pdb_file'][0].originalname.toLowerCase(),
      data_file: files['dat_file'][0].originalname.toLowerCase(),
      status: 'Submitted',
      time_submitted: now,
      user: user,
      steps: {
        pdb2crd: {},
        pae: {},
        autorg: {},
        minimize: {},
        initfoxs: {},
        heat: {},
        md: {},
        dcd2pdb: {},
        foxs: {},
        multifoxs: {},
        results: {},
        email: {}
      }
    })
    // logger.info(`in handleBilboMDScoperJob: ${newJob}`)
    // Save the job to the database
    await newJob.save()
    logger.info(`${bilbomdMode} Job saved to MongoDB: ${newJob.id}`)

    // Queue the job
    const BullId = await queueScoperJob({
      type: bilbomdMode,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${bilbomdMode} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${bilbomdMode} Job assigned BullMQ ID: ${BullId}`)
    res.status(200).json({
      message: `New ${bilbomdMode} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    // Log more detailed information about the error
    if (error instanceof Error) {
      logger.error(`Error in handleBilboMDScoperJob: ${error.message}`)
      logger.error(`Stack Trace: ${error.stack}`)
    } else {
      logger.error(`Non-standard error object: {error}`)
    }
    res.status(500).json({ message: 'Failed to create handleBilboMDScoperJob job' })
  }
}

const updateJobStatus = async (req: Request, res: Response) => {
  const { id, email, status } = req.body

  // Confirm data
  if (!id || !email || !status) {
    res.status(400).json({ message: 'All fields are required' })
  }

  // Confirm job exists to update
  const job = await Job.findById(id).exec()

  if (!job) {
    res.status(400).json({ message: 'Job not found' })
    return
  }

  // Check current status
  if (job.status == status) {
    res.status(400).json({ message: `nothing to do - status already ${job.status}` })
  }

  if (job.status == status) {
    res.status(400).json({ message: 'nothing to do' })
  }

  // Go ahead and update status
  job.status = status

  const updatedJob = await job.save()

  res.json(`'${updatedJob.title}' updated`)
}

const sanitizeConstInpFile = async (filePath: string): Promise<void> => {
  const fileContents = await fs.readFile(filePath, 'utf-8')
  const lines = fileContents.split('\n')
  const sanitizedLines: string[] = []

  for (const line of lines) {
    if (line.length > 78) {
      const wrappedLines = wrapLine(line)
      sanitizedLines.push(...wrappedLines)
    } else {
      sanitizedLines.push(line)
    }
  }

  const sanitizedContent = sanitizedLines.join('\n')
  await fs.writeFile(filePath, sanitizedContent, 'utf-8')
}

const wrapLine = (line: string): string[] => {
  const words = line.split(/\s+/)
  const wrappedLines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + word).length > 78) {
      wrappedLines.push(currentLine.trim() + ' -')
      currentLine = word + ' '
    } else {
      currentLine += word + ' '
    }
  }

  if (currentLine.trim().length > 0) {
    wrappedLines.push(
      currentLine.trim().endsWith('end')
        ? currentLine.trim()
        : currentLine.trim() + ' end'
    )
  }

  return wrappedLines
}

const deleteJob = async (req: Request, res: Response) => {
  const { id } = req.params

  // Confirm that client sent id
  if (!id) {
    res.status(400).json({ message: 'Job ID required' })
  }

  // Find the job to delete
  const job = await Job.findById(id).exec()

  if (!job) {
    res.status(400).json({ message: 'Job not found' })
    return
  }

  // Delete the job from MongoDB
  const deleteResult = await job.deleteOne()

  // Check if a document was actually deleted
  if (deleteResult.deletedCount === 0) {
    res.status(404).json({ message: 'No job was deleted' })
  }

  // Remove from disk
  const jobDir = path.join(uploadFolder, job.uuid)
  try {
    // Check if the directory exists and remove it
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      res.status(404).json({ message: 'Directory not found on disk' })
    }
    // Not sure if this is a NetApp issue or a Docker issue, but sometimes this fails
    // because there are dangles NFS lock files present.
    // This complicated bit of code is an attempt to make the job deletion function more robust.
    const maxAttempts = 10
    let attempt = 0
    const start = Date.now()
    while (attempt < maxAttempts) {
      try {
        logger.info(`Attempt ${attempt + 1} to remove ${jobDir}`)
        await fs.remove(jobDir)
        logger.info(`Removed ${jobDir}`)
        break
      } catch (error) {
        if (
          error instanceof Error &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error
        ) {
          if (error.code === 'ENOTEMPTY' || error.code === 'EBUSY') {
            // Log and wait before retrying
            logger.warn(
              `Attempt ${attempt + 1} to remove directory failed ${
                error.code
              }, retrying...`
            )
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))) // Exponential back-off could be considered
            attempt++
          } else {
            // Re-throw if it's an unexpected error
            throw error
          }
        } else {
          console.log(error)
        }
      }
    }
    const end = Date.now() // Get end time in milliseconds
    const duration = end - start // Calculate the duration in milliseconds
    logger.info(`Total time to attempt removal of ${jobDir}: ${duration} milliseconds.`)
  } catch (error) {
    logger.error(`Error deleting directory: ${error}`)
    res.status(500).send('Error deleting directory')
  }

  // Create response message
  const reply = `Deleted Job: '${job.title}' with ID ${job._id} and UUID: ${job.uuid}`

  res.status(200).json({ reply })
}

const getJobById = async (req: Request, res: Response) => {
  const jobId = req.params.id
  if (!jobId) {
    res.status(400).json({ message: 'Job ID required.' })
  }

  try {
    const job = (await Job.findOne({ _id: jobId }).exec()) as
      | IBilboMDPDBJob
      | IBilboMDCRDJob
      | IBilboMDAutoJob
      | IBilboMDScoperJob
      | IBilboMDAlphaFoldJob
      | IBilboMDSANSJob

    if (!job) {
      res.status(404).json({ message: `No job matches ID ${jobId}.` })
    }

    // const jobDir = path.join(uploadFolder, job.uuid, 'results')
    const jobDir = path.join(uploadFolder, job.uuid)

    let bullmq: BilboMDBullMQ | undefined

    // Instantiate a bilbomdJob object with id and MongoDB info
    const bilbomdJob: BilboMDJob = { id: jobId, mongo: job }

    // The goal is to eventually use the job-specific object to store results needed for the front end
    if (
      job.__t === 'BilboMdPDB' ||
      job.__t === 'BilboMdCRD' ||
      job.__t === 'BilboMd' ||
      job.__t === 'BilboMdSANS'
    ) {
      bullmq = await getBullMQJob(job.uuid)
      if (bullmq && 'bilbomdStep' in bullmq) {
        bilbomdJob.bullmq = bullmq
        bilbomdJob.classic = await calculateNumEnsembles(
          bullmq.bilbomdStep as BilboMDSteps,
          jobDir
        )
      }
    } else if (job.__t === 'BilboMdAuto') {
      bullmq = await getBullMQJob(job.uuid)
      if (bullmq && 'bilbomdStep' in bullmq) {
        bilbomdJob.bullmq = bullmq
        bilbomdJob.auto = await calculateNumEnsembles(
          bullmq.bilbomdStep as BilboMDSteps,
          jobDir
        )
      }
    } else if (job.__t === 'BilboMdAlphaFold') {
      bullmq = await getBullMQJob(job.uuid)
      if (bullmq) {
        bilbomdJob.bullmq = bullmq
        bilbomdJob.alphafold = await calculateNumEnsembles2(jobDir)
      }
    } else if (job.__t === 'BilboMdScoper') {
      const scoperJob = job as IBilboMDScoperJob
      bullmq = await getBullMQScoperJob(job.uuid)
      if (bullmq) {
        bilbomdJob.bullmq = bullmq
        bilbomdJob.scoper = await getScoperStatus(scoperJob)
      }
    }
    // logger.info(bilbomdJob)
    res.status(200).json(bilbomdJob)
  } catch (error) {
    logger.error(`Error retrieving job: ${error}`)
    res.status(500).json({ message: 'Failed to retrieve job.' })
  }
}

const calculateNumEnsembles = async (
  bilbomdStep: BilboMDSteps,
  jobDir: string
): Promise<BilboMDSteps> => {
  let numEnsembles = 0

  // Define the results directory
  const resultsDir = path.join(jobDir, 'results')

  // Check if the results directory exists
  try {
    await fs.promises.access(resultsDir, fs.constants.F_OK)
  } catch {
    // Log as info since it's normal that the directory might not exist yet
    logger.info(`Results directory does not exist: ${resultsDir}`)
    return {
      ...bilbomdStep,
      numEnsembles: 0 // Return 0 if the results folder is missing
    }
  }

  // Proceed to scan the results directory if it exists
  try {
    const files = await fs.promises.readdir(resultsDir)
    const ensemblePdbFilePattern = /ensemble_size_\d+_model\.pdb$/
    const ensembleFiles = files.filter((file) => ensemblePdbFilePattern.test(file))
    numEnsembles = ensembleFiles.length // Number of ensemble files found
  } catch (error) {
    logger.error(`calculateNumEnsembles Error reading directory: ${error}`)
  }

  return {
    ...bilbomdStep,
    numEnsembles: numEnsembles
  }
}

const calculateNumEnsembles2 = async (
  jobDir: string
): Promise<{ numEnsembles: number; message?: string }> => {
  const dirToScan = path.join(jobDir, 'results')

  // Check if the results directory exists
  try {
    await fs.promises.access(dirToScan, fs.constants.F_OK)
  } catch {
    // Log as info since it's expected that the directory might not exist yet
    logger.info(`Results directory does not exist: ${dirToScan}`)
    return {
      numEnsembles: 0,
      message: 'Results directory not found yet.'
    }
  }

  // Proceed to scan the results directory if it exists
  try {
    const files = await fs.promises.readdir(dirToScan)
    const ensemblePdbFilePattern = /ensemble_size_\d+_model\.pdb$/
    const ensembleFiles = files.filter((file) => ensemblePdbFilePattern.test(file))
    const numEnsembles = ensembleFiles.length

    if (numEnsembles === 0) {
      return {
        numEnsembles: 0,
        message: 'No ensemble files found yet.'
      }
    }

    return {
      numEnsembles: numEnsembles
    }
  } catch (error) {
    logger.error(`calculateNumEnsembles2 Error reading directory: ${error}`)
    return {
      numEnsembles: 0,
      message: 'Error reading directory or no files found.'
    }
  }
}

const downloadJobResults = async (req: Request, res: Response) => {
  if (!req?.params?.id) res.status(400).json({ message: 'Job ID required.' })

  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
    return
  }

  const outputFolder = path.join(uploadFolder, job.uuid)
  const defaultResultFile = path.join(outputFolder, 'results.tar.gz')
  const uuidPrefix = job.uuid.split('-')[0]
  const newResultFile = path.join(outputFolder, `results-${uuidPrefix}.tar.gz`)

  // Attempt to access and send the default results file
  try {
    await fs.promises.access(defaultResultFile)
    const filename = path.basename(defaultResultFile) // Extract filename for setting Content-Disposition
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.download(defaultResultFile, filename, (err) => {
      if (err) {
        res.status(500).json({
          message: 'Could not download the file: ' + err
        })
      }
    })
  } catch (error) {
    logger.error(`Error accessing default result file: ${error}`)
    // If the default file is not found, try the new file name
    try {
      await fs.promises.access(newResultFile)
      const filename = path.basename(newResultFile) // Extract new filename for setting Content-Disposition
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.download(newResultFile, filename, (err) => {
        if (err) {
          res.status(500).json({
            message: 'Could not download the file: ' + err
          })
        }
      })
    } catch (newFileError) {
      logger.error(`Error accessing new result file: ${newFileError}`)
      // If neither file is found, log error and return a message
      logger.error(`No result files available for job ID: ${req.params.id}`)
      res.status(500).json({ message: 'No result files available.' })
    }
  }
}

const getLogForStep = async (req: Request, res: Response) => {
  if (!req?.params?.id) res.status(400).json({ message: 'Job ID required.' })
  // Check if req.params.id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ message: 'Invalid Job ID format.' })
  }
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
    return
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
      res.status(500).json({ message: 'Error reading log file' })
    }

    // Send the log file content in a JSON response
    res.status(200).json({ logContent: data })
  })
}

const getKGSrnaProgress = async (directoryPath: string): Promise<number> => {
  try {
    const files = await fs.readdir(directoryPath)
    const pdbNumbers: number[] = files
      .filter((file) => file.startsWith('newpdb_') && file.endsWith('.pdb'))
      .map((file) => {
        const match = file.match(/newpdb_(\d+)\.pdb/)
        return match ? parseInt(match[1], 10) : 0
      })

    if (pdbNumbers.length === 0) {
      return 0 // Or -1, or any other indicator that no files were found
    }

    return Math.max(...pdbNumbers)
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error reading directory:', error.message)
    } else {
      console.error('Unexpected error:', error)
    }
    throw error // Rethrow or handle as needed
  }
}

const getScoperStatus = async (job: IBilboMDScoperJob): Promise<BilboMDScoperSteps> => {
  const scoper: BilboMDScoperSteps = {
    reduce: 'no',
    rnaview: 'no',
    kgs: 'no',
    kgsConformations: 0,
    kgsFiles: 0,
    foxs: 'no',
    foxsProgress: 0,
    foxsTopFile: '',
    foxsTopScore: 0,
    createdFeatures: false,
    IonNet: 'no',
    predictionThreshold: 0,
    multifoxs: 'no',
    multifoxsEnsembleSize: 0,
    multifoxsScore: 0,
    scoper: 'no',
    scoperPdb: '',
    results: 'no',
    email: 'no'
  }

  // scan the KGS output dir to calculate progress of KGS run
  const KGSOutputDir = path.join(uploadFolder, job.uuid, 'KGSRNA', job.pdb_file, 'output')
  const KGSFiles = await getKGSrnaProgress(KGSOutputDir)
  scoper.kgsFiles = KGSFiles

  // Can't scan the FoXS output directory at the moment since those files are
  // deleted almost immeadiatly.

  // Parse the scoper.log file fora slew of Scoper deets
  const scoperLogFile = path.join(uploadFolder, job.uuid, 'scoper.log')
  const fileStream = fs.createReadStream(scoperLogFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.includes('Adding hydrogens')) {
      scoper.reduce = 'end'
    } else if (line.includes('Running rnaview on input pdb')) {
      scoper.rnaview = 'end'
    } else if (line.match(/Running KGS with (\d+) samples/)) {
      const match = line.match(/Running KGS with (\d+) samples/)
      scoper.kgs = 'start'
      scoper.kgsConformations = match ? parseInt(match[1], 10) : 0
    } else if (line.match(/Getting FoXS scores for (\d+) structures/)) {
      scoper.foxs = 'start'
    } else if (line.match(/top_k_pdbs: \[\('(.+\.pdb)', (\d+\.\d+)\)\]/)) {
      const match = line.match(/top_k_pdbs: \[\('(.+\.pdb)', (\d+\.\d+)\)\]/)
      if (match) {
        scoper.foxs = 'end'
        scoper.foxsTopFile = match[1]
        scoper.foxsTopScore = parseFloat(match[2])
      }
    } else if (line.includes('Finished creating raw features')) {
      scoper.createdFeatures = true
    } else if (line.includes('Predicting with a threshold value of')) {
      const match = line.match(/Predicting with a threshold value of (\d+\.\d+)/)
      if (match) {
        scoper.predictionThreshold = parseFloat(match[1])
      }
    } else if (line.includes('Running MultiFoXS Combination')) {
      scoper.IonNet = 'end'
      scoper.multifoxs = 'start'
    } else if (line.includes('predicted ensemble is of size:')) {
      const match = line.match(/predicted ensemble is of size: (\d+)/)
      if (match) {
        scoper.multifoxs = 'end'
        scoper.multifoxsEnsembleSize = parseInt(match[1], 10)
      }
    } else if (line.includes('The lowest scoring ensemble is')) {
      const match = line.match(/The lowest scoring ensemble is (\d+\.\d+)/)
      if (match) {
        scoper.multifoxsScore = parseFloat(match[1])
      }
    }
  }

  // Check if the actual number of KGS files equals our expected number
  if (scoper.kgsFiles === scoper.kgsConformations) {
    scoper.kgs = 'end'
  }
  return scoper
}

const getAutoRg = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, 'autorg_uploads', UUID)
  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Create temporary AutoRg directory: ${jobDir}`)

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
        // await new Promise((resolve) => setTimeout(resolve, 5000))
        // Not sure if this is a NetApp issue or a Docker issue, but sometimes this fails
        // because there are dangling NFS lock files present.
        // This complicated bit of code is an attempt to make fs.remove more robust.
        const maxAttempts = 10
        let attempt = 0
        const baseDelay = 1000
        while (attempt < maxAttempts) {
          try {
            logger.info(`Call fs.remove on ${jobDir}`)
            await fs.remove(jobDir)
            logger.info(`Removed ${jobDir}`)
            break // Exit loop if successful
          } catch (error) {
            if (
              error instanceof Error &&
              typeof error === 'object' &&
              error !== null &&
              'code' in error
            ) {
              if (error.code === 'ENOTEMPTY' || error.code === 'EBUSY') {
                // Calculate the delay for the current attempt, doubling it each time
                const delay = baseDelay * Math.pow(2, attempt)
                logger.warn(
                  `Attempt ${attempt + 1} to remove directory failed ${
                    error.code
                  }, retrying...`
                )
                // Wait for the calculated delay before the next attempt
                await new Promise((resolve) => setTimeout(resolve, delay))
                attempt++
              } else {
                // Re-throw if it's an unexpected error
                throw error
              }
            } else {
              logger.error(error)
            }
          }
        }
      } catch (error) {
        logger.error(`Error calculating AutoRg: ${error}`)
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
  const tempOutputFile = path.join(os.tmpdir(), `autoRg_${Date.now()}.json`)
  const args = [autoRg_script, 'expdata.dat', tempOutputFile]

  return new Promise<AutoRgResults>((resolve, reject) => {
    const autoRg: ChildProcess = spawn('python', args, { cwd: dir })

    autoRg.stdout?.on('data', (data: Buffer) => {
      const dataString = data.toString().trim()
      const suppressMessage = "module 'scipy.integrate' has no attribute 'trapz'"

      // Check if the message should be suppressed
      if (dataString.includes(suppressMessage)) {
        logger.info(`Suppressed message: ${suppressMessage}`)
        return
      }

      logger.info(`spawnAutoRgCalculator stdout: ${dataString}`)
      logStream.write(dataString + '\n')
    })

    autoRg.stderr?.on('data', (data: Buffer) => {
      const dataString = data.toString().trim()
      logger.error(`spawnAutoRgCalculator stderr: ${dataString}`)
      errorStream.write(dataString + '\n')
    })

    autoRg.on('error', (error) => {
      logger.error(`spawnAutoRgCalculator error: ${error}`)
      reject(error)
    })

    autoRg.on('exit', async (code) => {
      // Close streams explicitly once the process exits
      logStream.end()
      errorStream.end()

      if (code === 0) {
        try {
          const analysisResults = JSON.parse(
            await fs.promises.readFile(tempOutputFile, 'utf-8')
          )
          logger.info(`spawnAutoRgCalculator success with exit code: ${code}`)
          resolve(analysisResults)
        } catch (parseError) {
          logger.error(`Error parsing analysis results: ${parseError}`)
          reject(parseError)
        } finally {
          // Clean up the temporary file
          // await fs.promises.unlink(tempOutputFile)
        }
      } else {
        logger.error(`spawnAutoRgCalculator error with exit code: ${code}`)
        reject(new Error(`spawnAutoRgCalculator error with exit code: ${code}`))
      }
    })
  })
}

const writeJobParams = async (jobID: string): Promise<void> => {
  try {
    const job = await Job.findById(jobID).populate('user').exec()
    if (!job) {
      throw new Error('Job not found')
    }
    const UUID = job.uuid
    // Convert the Mongoose document to a plain object
    const jobObject = job.toObject({ virtuals: true, versionKey: false })
    // Exclude metadata like mongoose versionKey, etc, if necessary
    // delete jobObject.__v // Optionally remove version key if not done globally

    // Serialize to JSON with pretty printing
    const jobJson = JSON.stringify(jobObject, null, 2)
    const jobDir = path.join(uploadFolder, UUID)
    // Define the path for the params.json file
    const paramsFilePath = path.join(jobDir, 'params.json') // Adjust the directory path as needed

    // Write JSON string to a file
    await fs.writeFile(paramsFilePath, jobJson)
    console.log(`Saved params.json to ${paramsFilePath}`)
  } catch (error) {
    logger.error(`Unable to save params.json: ${error}`)
  }
}

export {
  getAllJobs,
  createNewJob,
  updateJobStatus,
  deleteJob,
  getJobById,
  downloadJobResults,
  getLogForStep,
  getAutoRg,
  writeJobParams,
  sanitizeConstInpFile
}
