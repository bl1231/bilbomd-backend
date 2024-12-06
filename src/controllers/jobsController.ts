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
  User,
  IUser,
  BilboMdPDBJob,
  IBilboMDPDBJob,
  BilboMdCRDJob,
  IBilboMDCRDJob,
  BilboMdAutoJob,
  IBilboMDAutoJob,
  BilboMdScoperJob,
  IBilboMDScoperJob,
  IBilboMDSteps,
  MultiJob,
  IMultiJob
} from '@bl1231/bilbomd-mongodb-schema'
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

    // Fetch jobs from both Job and MultiJob collections
    const [DBjobs, DBmultiJobs] = await Promise.all([
      Job.find(jobFilter).lean() as Promise<IJob[]>,
      MultiJob.find(jobFilter).lean() as Promise<IMultiJob[]>
    ])

    // Combine both job types
    const allJobs = [...DBjobs, ...DBmultiJobs]

    if (!allJobs?.length) {
      logger.info('No jobs found')
      res.status(204).json({ message: 'No jobs found' })
      return
    }

    // Process and format jobs
    const formattedJobs = await Promise.all(
      allJobs.map(async (mongo) => {
        const user = await User.findById(mongo.user).lean().exec()

        let bullmq = null
        if (['BilboMd', 'BilboMdAuto'].includes(mongo.__t)) {
          bullmq = await getBullMQJob(mongo.uuid)
        } else if (mongo.__t === 'BilboMdScoper') {
          bullmq = await getBullMQScoperJob(mongo.uuid)
        }

        return {
          mongo,
          bullmq,
          username: user?.username
        }
      })
    )

    res.status(200).json(formattedJobs)
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
          await handleBilboMDJob(req, res, user, UUID)
        } else if (bilbomd_mode === 'auto') {
          logger.info('about to handleBilboMDAutoJob')
          await handleBilboMDAutoJob(req, res, user, UUID)
        } else if (bilbomd_mode === 'scoper') {
          logger.info('about to handleBilboMDScoperJob')
          await handleBilboMDScoperJob(req, res, user, UUID)
        } else {
          return res.status(400).json({ message: 'Invalid job type' })
        }
      } catch (error) {
        logger.error(error)
        return res.status(500).json({ message: 'Internal server error' })
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
    const { bilbomd_mode: bilbomdMode, title, num_conf, rg, rg_min, rg_max } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(`bilbomdMode: ${bilbomdMode}`)
    logger.info(`title: ${title}`)

    const constInpFile = files['constinp'][0].originalname.toLowerCase()
    const dataFile = files['expdata'][0].originalname.toLowerCase()

    // Create and sanitize job directory and files
    const jobDir = path.join(uploadFolder, UUID)
    const constInpFilePath = path.join(jobDir, constInpFile)
    const constInpOrigFilePath = path.join(jobDir, `${constInpFile}.orig`)

    await fs.copyFile(constInpFilePath, constInpOrigFilePath)
    await sanitizeConstInpFile(constInpFilePath)

    // Initialize common job data
    const commonJobData = {
      __t: '',
      title,
      uuid: UUID,
      status: 'Submitted',
      data_file: dataFile,
      const_inp_file: constInpFile, // Add const_inp_file here
      time_submitted: new Date(),
      user,
      progress: 0,
      cleanup_in_progress: false,
      steps: {
        minimize: {},
        initfoxs: {},
        heat: {},
        md: {},
        dcd2pdb: {},
        pdb_remediate: {},
        foxs: {},
        multifoxs: {},
        results: {},
        email: {}
      } as IBilboMDSteps
    }

    let newJob: IBilboMDPDBJob | IBilboMDCRDJob | undefined

    if (bilbomdMode === 'crd_psf') {
      const psfFile = files['psf_file']?.[0]?.originalname.toLowerCase() || ''
      const crdFile = files['crd_file']?.[0]?.originalname.toLowerCase() || ''

      newJob = new BilboMdCRDJob({
        ...commonJobData,
        __t: 'BilboMdCRD',
        psf_file: psfFile,
        crd_file: crdFile,
        conformational_sampling: num_conf,
        rg,
        rg_min,
        rg_max
      })
    } else if (bilbomdMode === 'pdb') {
      const pdbFile = files['pdb_file']?.[0]?.originalname.toLowerCase() || ''

      newJob = new BilboMdPDBJob({
        ...commonJobData,
        __t: 'BilboMdPDB',
        pdb_file: pdbFile,
        conformational_sampling: num_conf,
        rg,
        rg_min,
        rg_max,
        steps: { ...commonJobData.steps, pdb2crd: {} } // Add pdb2crd step
      })
    }

    // Handle unsupported modes
    if (!newJob) {
      logger.error(`Unsupported bilbomd_mode: ${bilbomdMode}`)
      return res.status(400).json({ message: 'Invalid bilbomd_mode specified' })
    }

    // Save the job and write job parameters
    await newJob.save()
    logger.info(`BilboMD-${bilbomdMode} Job saved to MongoDB: ${newJob.id}`)
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

    // Respond with job details
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
        : 'missing.dat'
    logger.info(`PDB File: ${pdbFileName}`)
    logger.info(`PAE File: ${paeFileName}`)

    const jobDir = path.join(uploadFolder, UUID)
    const autorgResults: AutoRgResults = await spawnAutoRgCalculator(jobDir, datFileName)

    const now = new Date()

    const newJob: IBilboMDAutoJob = new BilboMdAutoJob({
      title: req.body.title,
      uuid: UUID,
      pdb_file: pdbFileName,
      pae_file: paeFileName,
      data_file: datFileName,
      rg: autorgResults.rg,
      rg_min: autorgResults.rg_min,
      rg_max: autorgResults.rg_max,
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
        pae_power: '2.0',
        plddt_cutoff: '50'
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
    const { bilbomd_mode: bilbomdMode, title, fixc1c2 } = req.body
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
    logger.info(`fixc1c2: ${fixc1c2}`)
    const newJob: IBilboMDScoperJob = new BilboMdScoperJob({
      title,
      uuid: UUID,
      pdb_file: files['pdb_file'][0].originalname.toLowerCase(),
      data_file: files['dat_file'][0].originalname.toLowerCase(),
      fixc1c2,
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

  if (!id) {
    res.status(400).json({ message: 'Job ID required' })
    return
  }

  try {
    // Check if the job is a standard Job or a MultiJob
    const job = await Job.findById(id).exec()
    const multiJob = await MultiJob.findById(id).exec()

    if (!job && !multiJob) {
      res.status(400).json({ message: 'Job not found' })
      return
    }

    if (job) {
      // Handle standard Job deletion
      await handleStandardJobDeletion(job, res)
    } else if (multiJob) {
      // Handle MultiJob deletion
      await handleMultiJobDeletion(multiJob, res)
    }
  } catch (error) {
    logger.error(`Error deleting job: ${error}`)
    res.status(500).json({ message: 'Internal server error during job deletion' })
  }
}

const handleStandardJobDeletion = async (job: IJob, res: Response) => {
  const deleteResult = await job.deleteOne()

  if (!deleteResult) {
    res.status(404).json({ message: 'No job was deleted' })
    return
  }

  await removeJobDirectory(job.uuid, res)

  const reply = `Deleted Job: '${job.title}' with ID ${job._id} and UUID: ${job.uuid}`
  res.status(200).json({ reply })
}

const handleMultiJobDeletion = async (multiJob: IMultiJob, res: Response) => {
  // Delete the MultiJob itself
  const deleteResult = await multiJob.deleteOne()

  if (!deleteResult) {
    res.status(404).json({ message: 'No MultiJob was deleted' })
    return
  }

  await removeJobDirectory(multiJob.uuid, res)

  const reply = `Deleted MultiJob: '${multiJob.title}' with ID ${multiJob._id} and UUID: ${multiJob.uuid}`
  res.status(200).json({ reply })
}

const removeJobDirectory = async (uuid: string, res: Response) => {
  const jobDir = path.join(uploadFolder, uuid)
  try {
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      logger.warn(`Directory not found on disk for UUID: ${uuid}`)
      return
    }

    const maxAttempts = 10
    let attempt = 0
    const start = Date.now()

    while (attempt < maxAttempts) {
      try {
        logger.info(`Attempt ${attempt + 1} to remove ${jobDir}`)
        await fs.remove(jobDir)
        logger.info(`Removed ${jobDir}`)
        break
      } catch (err) {
        const error = err as NodeJS.ErrnoException // Explicitly cast the error
        if (error.code === 'ENOTEMPTY' || error.code === 'EBUSY') {
          logger.warn(
            `Attempt ${attempt + 1} to remove directory failed: ${
              error.code
            }, retrying...`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          attempt++
        } else {
          throw error // Re-throw if it's an unexpected error
        }
      }
    }

    const end = Date.now()
    const duration = end - start
    logger.info(`Total time to attempt removal of ${jobDir}: ${duration} ms.`)
  } catch (error) {
    logger.error(`Error deleting directory: ${error}`)
    res.status(500).json({ message: 'Error deleting directory' })
  }
}

const getJobById = async (req: Request, res: Response) => {
  const jobId = req.params.id
  if (!jobId) {
    res.status(400).json({ message: 'Job ID required.' })
    return
  }

  try {
    // Search in both collections
    const job = await Job.findOne({ _id: jobId }).exec()
    const multiJob = job ? null : await MultiJob.findOne({ _id: jobId }).exec()

    // Handle case where job is not found in either collection
    if (!job && !multiJob) {
      res.status(404).json({ message: `No job matches ID ${jobId}.` })
      return
    }

    // Determine job type
    if (job) {
      // Process Job collection entries
      const jobDir = path.join(uploadFolder, job.uuid)
      let bullmq: BilboMDBullMQ | undefined

      const bilbomdJob: BilboMDJob = { id: jobId, mongo: job }

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
        bullmq = await getBullMQScoperJob(job.uuid)
        if (bullmq) {
          bilbomdJob.bullmq = bullmq
          bilbomdJob.scoper = await getScoperStatus(job as unknown as IBilboMDScoperJob)
        }
      }

      res.status(200).json(bilbomdJob)
    } else if (multiJob) {
      // Process MultiJob collection entries
      const multiJobDir = path.join(uploadFolder, multiJob.uuid)

      // Construct a response for MultiJob
      const multiJobResponse = {
        id: jobId,
        mongo: multiJob,
        jobDir: multiJobDir,
        status: multiJob.status,
        progress: multiJob.progress
      }

      res.status(200).json(multiJobResponse)
    }
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
  const { id } = req.params

  if (!id) {
    res.status(400).json({ message: 'Job ID required.' })
    return
  }

  try {
    // Find the job in either Job or MultiJob collection
    const job = await Job.findById(id).exec()
    const multiJob = await MultiJob.findById(id).exec()

    if (!job && !multiJob) {
      res.status(404).json({ message: `No job matches ID ${id}.` })
      return
    }

    // Determine the result file path based on job type
    const { uuid } = job || multiJob!
    const outputFolder = path.join(uploadFolder, uuid)
    const uuidPrefix = uuid.split('-')[0]
    const resultFilePath = path.join(outputFolder, `results-${uuidPrefix}.tar.gz`)

    // Check if the results file exists
    try {
      await fs.access(resultFilePath)
    } catch (error) {
      res.status(404).json({ message: 'Results file not found.' })
      logger.warn(`Results file not found for job ID: ${id} - ${error}`)
      return
    }

    // Set headers and initiate file download
    const filename = path.basename(resultFilePath)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.download(resultFilePath, filename, (err) => {
      if (err) {
        logger.error(`Error during file download: ${err}`)
        res.status(500).json({ message: `Could not download the file: ${err.message}` })
      }
    })
  } catch (error) {
    logger.error(`Error retrieving job: ${error}`)
    res.status(500).json({ message: 'An error occurred while processing your request.' })
  }
}

const getLogForStep = async (req: Request, res: Response) => {
  if (!req?.params?.id) res.status(400).json({ message: 'Job ID required.' })
  // Check if req.params.id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ message: 'Invalid Job ID format.' })
    return
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

        const autorgResults: AutoRgResults = await spawnAutoRgCalculator(
          jobDir,
          'expdata.dat'
        )
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

const spawnAutoRgCalculator = async (
  dir: string,
  datFileName: string
): Promise<AutoRgResults> => {
  const logFile = path.join(dir, 'autoRg.log')
  const errorFile = path.join(dir, 'autoRg_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const autoRg_script = '/app/scripts/autorg.py'
  const tempOutputFile = path.join(os.tmpdir(), `autoRg_${Date.now()}.json`)
  const args = [autoRg_script, datFileName, tempOutputFile]

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
  sanitizeConstInpFile,
  spawnAutoRgCalculator
}
