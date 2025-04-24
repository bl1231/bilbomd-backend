import path from 'path'
import { logger } from '../../middleware/loggers.js'
import {
  BilboMdAlphaFoldJob,
  IBilboMDAlphaFoldJob,
  IAlphaFoldEntity
} from '@bl1231/bilbomd-mongodb-schema'
import { alphafoldJobSchema } from '../../validation/index.js'
import { ValidationError } from 'yup'
import { IUser } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { writeJobParams, spawnAutoRgCalculator } from './index.js'
import { queueJob } from '../../queues/bilbomd.js'
import { createFastaFile } from './utils/createFastaFile.js'
import { parseAlphaFoldEntities } from './utils/parseAlphaFoldEntities.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

type AutoRgResults = {
  rg: number
  rg_min: number
  rg_max: number
}

const handleBilboMDAlphaFoldJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  const jobDir = path.join(uploadFolder, UUID)
  const { bilbomd_mode: bilbomdMode } = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  logger.info(`bilbomdMode: ${bilbomdMode}`)
  logger.info(`title: ${req.body.title}`)

  let parsedEntities: IAlphaFoldEntity[] = []

  try {
    parsedEntities = parseAlphaFoldEntities(req.body)
    logger.info(`Parsed ${parsedEntities.length} AlphaFold entities`)
  } catch (parseErr) {
    logger.error('Failed to parse entities_json or reconstruct entities', parseErr)
    return res
      .status(400)
      .json({ message: 'Invalid entities_json or malformed form data' })
  }

  // Collect data for validation
  const datFile = files['dat_file']?.[0]
  logger.info(`datFile = ${datFile?.originalname}, path = ${datFile?.path}`)
  const jobPayload = {
    title: req.body.title,
    bilbomd_mode: req.body.bilbomd_mode,
    email: req.body.email,
    dat_file: datFile,
    entities: parsedEntities
  }

  // Validate
  try {
    await alphafoldJobSchema.validate(jobPayload, { abortEarly: false })
  } catch (validationErr) {
    if (validationErr instanceof ValidationError) {
      logger.warn('AlphaFold job payload validation failed', validationErr)
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErr.inner?.map((err) => ({
          path: err.path,
          message: err.message
        }))
      })
    } else {
      throw validationErr
    }
  }

  // Create the FASTA file
  await createFastaFile(parsedEntities, jobDir)

  try {
    const datFileName =
      files['dat_file'] && files['dat_file'][0]
        ? files['dat_file'][0].originalname.toLowerCase()
        : 'missing.dat'

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
      alphafold_entities: parsedEntities,
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

export { handleBilboMDAlphaFoldJob }
