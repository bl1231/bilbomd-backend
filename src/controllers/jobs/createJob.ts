import { logger } from '../../middleware/loggers.js'
import { config } from '../../config/config.js'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { v4 as uuid } from 'uuid'

import { queueJob } from '../../queues/bilbomd.js'
import { queueScoperJob } from '../../queues/scoper.js'
import {
  queueJob as queuePdb2CrdJob,
  waitForJobCompletion,
  pdb2crdQueueEvents
} from '../../queues/pdb2crd.js'
import {
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
  IBilboMDSteps
} from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { AutoRgResults } from '../../types/bilbomd.js'
import { writeJobParams, sanitizeConstInpFile } from './jobUtils.js'
import { spawnAutoRgCalculator } from './autoRg.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const createNewJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)

  try {
    // Create the job directory
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Created directory: ${jobDir}`)

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, jobDir),
      filename: (req, file, cb) => cb(null, file.originalname.toLowerCase())
    })

    const upload = multer({ storage: storage })

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
        res.status(500).json({ message: 'Failed to upload one or more files' })
        return
      }

      try {
        const { email, bilbomd_mode } = req.body
        if (!bilbomd_mode) {
          res.status(400).json({ message: 'No job type provided' })
          return
        }

        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          res.status(401).json({ message: 'No user found with that email' })
          return
        }

        // Update jobCount and jobTypes
        const jobTypeField = `jobTypes.${bilbomd_mode}`
        await User.findByIdAndUpdate(foundUser._id, {
          $inc: { jobCount: 1, [jobTypeField]: 1 }
        })

        // Route to the appropriate handler
        if (bilbomd_mode === 'pdb' || bilbomd_mode === 'crd_psf') {
          logger.info(`Handling BilboMDJob: ${bilbomd_mode}`)
          await handleBilboMDJob(req, res, foundUser, UUID)
        } else if (bilbomd_mode === 'auto') {
          logger.info('Handling BilboMDAutoJob')
          await handleBilboMDAutoJob(req, res, foundUser, UUID)
        } else if (bilbomd_mode === 'scoper') {
          logger.info('Handling BilboMDScoperJob')
          await handleBilboMDScoperJob(req, res, foundUser, UUID)
        } else {
          res.status(400).json({ message: 'Invalid job type' })
        }
      } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Internal server error' })
      }
    })
  } catch (error) {
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

export { createNewJob }
