import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs-extra'
import mongoose from 'mongoose'
import { logger } from '../middleware/loggers.js'
import multer from 'multer'
import {
  BilboMdSANSJob,
  IBilboMDSANSJob,
  User,
  IUser
} from '@bl1231/bilbomd-mongodb-schema'
import { Express, Request, Response } from 'express'
import { sanitizeConstInpFile, writeJobParams } from './jobsController.js'
import { queueJob } from '../queues/bilbomd.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const createNewSANSJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)
  let user: IUser
  logger.info(`createNewSANSJob ${UUID}`)
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
    upload.fields([
      { name: 'pdb_file', maxCount: 1 },
      { name: 'dat_file', maxCount: 1 },
      { name: 'inp_file', maxCount: 1 }
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

        // Create the FASTA file
        // await createFastaFile(parsedEntities, jobDir)

        // Handle the job creation
        await handleBilboMDSANSJob(req, res, user, UUID, jobDir)
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

const handleBilboMDSANSJob = async (
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

    const pdbFile =
      files['pdb_file'] && files['pdb_file'][0]
        ? files['pdb_file'][0].originalname.toLowerCase()
        : ''
    const dataFile =
      files['dat_file'] && files['dat_file'][0]
        ? files['dat_file'][0].originalname.toLowerCase()
        : ''
    const constInpFile =
      files['inp_file'] && files['inp_file'][0]
        ? files['inp_file'][0].originalname.toLowerCase()
        : ''

    // Rename the original constinp file to create a backup
    const constInpFilePath = path.join(jobDir, constInpFile)
    const constInpOrigFilePath = path.join(jobDir, `${constInpFile}.orig`)

    await fs.copyFile(constInpFilePath, constInpOrigFilePath)

    // Sanitize the uploaded file (constInpFilePath)
    await sanitizeConstInpFile(constInpFilePath)

    const now = new Date()
    // logger.info(`now ${now}`)
    const newJob: IBilboMDSANSJob = new BilboMdSANSJob({
      title: req.body.title,
      uuid: UUID,
      pdb_file: pdbFile,
      data_file: dataFile,
      const_inp_file: constInpFile,
      conformational_sampling: 3,
      rg_min: 30,
      rg_max: 50,
      status: 'Submitted',
      time_submitted: now,
      user: user,
      steps: {
        alphafold: {},
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
        copy_results_to_cfs: {},
        results: {},
        email: {}
      }
    })
    // logger.info(`newJob ${newJob}`)
    // Save the job to the database
    try {
      await newJob.save()
    } catch (error) {
      if (error instanceof mongoose.Error.ValidationError) {
        logger.error(`Validation Error: ${error.message}`)
      } else if (error instanceof Error) {
        logger.error(`Error saving newJob: ${error}`)
      } else {
        logger.error(`Unknown error: ${error}`)
      }
      res.status(500).json({ message: 'Failed to save the job to the database' })
      return
    }

    logger.info(`${bilbomdMode} Job saved to  MongoDB: ${newJob.id}`)

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
      message: `New ${bilbomdMode} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ message: 'Failed to create BilboMD SANS Job' })
  }
}

export { createNewSANSJob }
