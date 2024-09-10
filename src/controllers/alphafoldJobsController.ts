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
import { writeJobParams } from './jobsController.js'
import { queueJob } from '../queues/bilbomd.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const createNewAlphaFoldJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)
  let user: IUser
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
        return res.status(500).json({ message: 'Failed to upload one or more files' })
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
          return res
            .status(400)
            .json({ message: 'You can only submit up to 20 entities.' })
        }

        const foundUser = await User.findOne({ email }).exec()

        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }

        if (!bilbomd_mode) {
          return res.status(400).json({ message: 'No job type provided' })
        }

        user = foundUser

        // Create the FASTA file
        await createFastaFile(parsedEntities, jobDir)

        // Handle the job creation
        await handleBilboMDAlphaFoldJobCreation(req, res, user, UUID, parsedEntities)
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
  entities: IAlphaFoldEntity[]
) => {
  const { bilbomd_mode: bilbomdMode } = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  logger.info(`bilbomdMode: ${bilbomdMode}`)
  logger.info(`title: ${req.body.title}`)
  logger.info(`entities: ${JSON.stringify(entities)}`) // Log parsed entities to check
  try {
    const datFileName =
      files['dat_file'] && files['dat_file'][0]
        ? files['dat_file'][0].originalname.toLowerCase()
        : 'missing.dat'
    const now = new Date()

    const newJob: IBilboMDAlphaFoldJob = new BilboMdAlphaFoldJob({
      title: req.body.title,
      uuid: UUID,
      data_file: datFileName,
      fasta_file: 'af-entities.fasta',
      entities,
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
  let fastaContent = ''

  // Loop over the entities and format them as FASTA
  entities.forEach((entity, index) => {
    // Repeat each entity `copies` times
    for (let i = 0; i < entity.copies; i++) {
      fastaContent += `> ${entity.name || `entity_${index}`}_copy_${i + 1}\n${
        entity.sequence
      }\n`
    }
  })

  // Define the path for the FASTA file
  const fastaFilePath = path.join(jobDir, 'af-entities.fasta')

  // Write the FASTA content to the file
  await fs.writeFile(fastaFilePath, fastaContent)

  logger.info(`FASTA file created: ${fastaFilePath}`)
}

export { createNewAlphaFoldJob }
