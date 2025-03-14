import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs-extra'
import { logger } from '../middleware/loggers.js'
import multer from 'multer'
import {
  BilboMdAlphaFoldJob,
  IBilboMDAlphaFoldJob,
  IAlphaFoldEntity
} from '@bl1231/bilbomd-mongodb-schema'
import { User, IUser } from '@bl1231/bilbomd-mongodb-schema'
import { Express, Request, Response } from 'express'
import { writeJobParams, spawnAutoRgCalculator } from './jobsController.js'
import { queueJob } from '../queues/bilbomd.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

type AutoRgResults = {
  rg: number
  rg_min: number
  rg_max: number
}

const createNewAlphaFoldJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)

  logger.info('createNewAlphaFoldJob')
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
    upload.fields([{ name: 'dat_file', maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        res.status(500).json({ message: 'Failed to upload one or more files' })
        return
      }

      try {
        const { email, bilbomd_mode, entities } = req.body

        // Convert string values for "copies" to integers
        const parsedEntities = entities.map((entity: IAlphaFoldEntity) => ({
          ...entity,
          copies: parseInt(entity.copies as unknown as string, 10) // Convert copies to an integer
        }))

        // Check if the number of entities exceeds the maximum allowed
        if (parsedEntities.length > 20) {
          res.status(400).json({ message: 'You can only submit up to 20 entities.' })
          return
        }

        const foundUser = await User.findOne({ email }).exec()

        if (!foundUser) {
          res.status(401).json({ message: 'No user found with that email' })
          return
        }

        if (!bilbomd_mode) {
          res.status(400).json({ message: 'No job type provided' })
          return
        }

        // Update jobCount and jobTypes
        const jobTypeField = `jobTypes.${bilbomd_mode}`
        await User.findByIdAndUpdate(foundUser._id, {
          $inc: { jobCount: 1, [jobTypeField]: 1 }
        })

        // Create the FASTA file
        await createFastaFile(parsedEntities, jobDir)

        // Handle the job creation
        await handleBilboMDAlphaFoldJobCreation(req, res, foundUser, UUID, parsedEntities)
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

const handleBilboMDAlphaFoldJobCreation = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string,
  alphafold_entities: IAlphaFoldEntity[]
) => {
  const { bilbomd_mode: bilbomdMode } = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  logger.info(`bilbomdMode: ${bilbomdMode}`)
  logger.info(`title: ${req.body.title}`)
  // logger.info(`entities: ${JSON.stringify(alphafold_entities)}`) // Log parsed entities to check
  try {
    const datFileName =
      files['dat_file'] && files['dat_file'][0]
        ? files['dat_file'][0].originalname.toLowerCase()
        : 'missing.dat'

    const jobDir = path.join(uploadFolder, UUID)
    const autorgResults: AutoRgResults = await spawnAutoRgCalculator(jobDir, datFileName)
    const now = new Date()

    const newJob: IBilboMDAlphaFoldJob = new BilboMdAlphaFoldJob({
      title: req.body.title,
      uuid: UUID,
      data_file: datFileName,
      rg: autorgResults.rg,
      rg_min: autorgResults.rg_min,
      rg_max: autorgResults.rg_max,
      fasta_file: 'af-entities.fasta',
      alphafold_entities,
      conformational_sampling: 3,
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

    // Save the job to the database
    await newJob.save()
    logger.info(`${bilbomdMode} Job saved to MongoDB: ${newJob.id}`)

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
    res.status(500).json({ message: 'Failed to create handleBilboMDAlphaFoldJob job' })
  }
}

const createFastaFile = async (entities: IAlphaFoldEntity[], jobDir: string) => {
  // Determine the header
  let header = ''
  if (entities.length === 1) {
    header = entities[0].copies > 1 ? '>multimer' : '>single-chain'
  } else {
    header = '>complex'
  }

  // Generate the sequence lines
  const sequenceLines = entities
    .flatMap((entity) => {
      return Array.from({ length: entity.copies }, () => entity.sequence)
    })
    .map((sequence, idx, arr) => {
      return idx === arr.length - 1 ? sequence : `${sequence}:`
    })
    .join('\n')

  // Combine the header and sequences
  const fastaContent = `${header}\n${sequenceLines}`

  // Define the path for the FASTA file
  const fastaFilePath = path.join(jobDir, 'af-entities.fasta')

  // Write the FASTA content to the file
  await fs.writeFile(fastaFilePath, fastaContent)

  logger.info(`FASTA file created: ${fastaFilePath}`)
}

export { createNewAlphaFoldJob }
