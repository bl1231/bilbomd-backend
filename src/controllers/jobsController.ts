import { logger } from '../middleware/loggers'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs-extra'
import readline from 'readline'
import path from 'path'
import { v4 as uuid } from 'uuid'
const spawn = require('child_process').spawn
import { queueJob, getBullMQJob } from '../queues/bilbomd'
import { queueScoperJob, getBullMQScoperJob } from '../queues/scoper'
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
import { IJob, BilboMDScoperSteps } from 'types/bilbomd'
import { BilboMDJob } from 'types/bilbomd'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

type AutoRgResults = {
  rg: number
  rg_min: number
  rg_max: number
}

const getAllJobs = async (req: Request, res: Response) => {
  try {
    const DBjobs: Array<IJob> = await Job.find().lean()

    if (!DBjobs?.length) {
      return res.status(204).json({})
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

const getJobById = async (req: Request, res: Response) => {
  const jobId = req.params.id
  if (!jobId) {
    return res.status(400).json({ message: 'Job ID required.' })
  }

  try {
    // const job = await Job.findOne({ _id: jobId }).exec()
    const job = (await Job.findOne({ _id: jobId }).exec()) as
      | IBilboMDJob
      | IBilboMDAutoJob
      | IBilboMDScoperJob

    if (!job) {
      return res.status(404).json({ message: `No job matches ID ${jobId}.` })
    }

    let bullmq
    let bilbomdJob: BilboMDJob = { mongo: job }
    let scoper: BilboMDScoperSteps
    if (['BilboMd', 'BilboMdAuto'].includes(job.__t)) {
      bullmq = await getBullMQJob(job.uuid)
      bilbomdJob.bullmq = bullmq
    } else if (job.__t === 'BilboMdScoper') {
      const scoperJob = job as IBilboMDScoperJob
      bullmq = await getBullMQScoperJob(job.uuid)
      scoper = await getScoperStatus(scoperJob)
      bilbomdJob.bullmq = bullmq
      bilbomdJob.scoper = scoper
    }

    res.status(200).json(bilbomdJob)
  } catch (error) {
    logger.error('Error retrieving job:', error)
    res.status(500).json({ message: 'Failed to retrieve job.' })
  }
}

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
    addHydrogens: false,
    runRNAview: false,
    KGSConformations: 0,
    KGSFiles: 0,
    FoXS: 'no',
    FoXSProgress: 0,
    FoXSTopFile: '',
    FoXSTopScore: 0,
    createdFeatures: false,
    predictionThreshold: 0,
    MultiFoXS: 'no',
    MultiFoXSEnsembleSize: 0,
    MultiFoXSScore: 0,
    scoper: 'no',
    results: 'no',
    email: 'no'
  }

  // scan the KGS output dir to calculate progress of KGS run
  const KGSOutputDir = path.join(uploadFolder, job.uuid, 'KGSRNA', job.pdb_file, 'output')
  const KGSFiles = await getKGSrnaProgress(KGSOutputDir)
  scoper.KGSFiles = KGSFiles

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
      scoper.addHydrogens = true
    } else if (line.includes('Running rnaview on input pdb')) {
      scoper.runRNAview = true
    } else if (line.match(/Running KGS with (\d+) samples/)) {
      const match = line.match(/Running KGS with (\d+) samples/)
      scoper.KGSConformations = match ? parseInt(match[1], 10) : 0
    } else if (line.match(/Getting FoXS scores for (\d+) structures/)) {
      scoper.FoXS = 'start'
    } else if (line.match(/top_k_pdbs: \[\('(.+\.pdb)', (\d+\.\d+)\)\]/)) {
      const match = line.match(/top_k_pdbs: \[\('(.+\.pdb)', (\d+\.\d+)\)\]/)
      if (match) {
        scoper.FoXS = 'end'
        scoper.FoXSTopFile = match[1]
        scoper.FoXSTopScore = parseFloat(match[2])
      }
    } else if (line.includes('Finished creating raw features')) {
      scoper.createdFeatures = true
    } else if (line.includes('Predicting with a threshold value of')) {
      const match = line.match(/Predicting with a threshold value of (\d+\.\d+)/)
      if (match) {
        scoper.predictionThreshold = parseFloat(match[1])
      }
    } else if (line.includes('Running MultiFoXS Combination')) {
      scoper.MultiFoXS = 'start'
    } else if (line.includes('predicted ensemble is of size:')) {
      const match = line.match(/predicted ensemble is of size: (\d+)/)
      if (match) {
        scoper.MultiFoXS = 'end'
        scoper.MultiFoXSEnsembleSize = parseInt(match[1], 10)
      }
    } else if (line.includes('The lowest scoring ensemble is')) {
      const match = line.match(/The lowest scoring ensemble is (\d+\.\d+)/)
      if (match) {
        scoper.MultiFoXSScore = parseFloat(match[1])
      }
    }
  }

  return scoper
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
