import path from 'path'
import { logger } from '../../middleware/loggers.js'
import {
  BilboMdAlphaFoldJob,
  IBilboMDAlphaFoldJob,
  IAlphaFoldEntity
} from '@bl1231/bilbomd-mongodb-schema'
import { IUser } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { writeJobParams, spawnAutoRgCalculator } from './index.js'
import { queueJob } from '../../queues/bilbomd.js'
import { createFastaFile } from './utils/createFastaFile.js'

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
    if (req.body.entities_json) {
      parsedEntities = JSON.parse(req.body.entities_json)
      logger.info(`Parsed ${parsedEntities.length} entities from entities_json`)
    } else if (Array.isArray(req.body.entities)) {
      parsedEntities = req.body.entities.map((entity: IAlphaFoldEntity) => ({
        ...entity,
        copies: parseInt(entity.copies as unknown as string, 10)
      }))
      logger.info(`Parsed ${parsedEntities.length} entities from form fields`)
    } else {
      // Fallback in case entities are not parsed into array form
      const raw = req.body as Record<string, string>
      const entityIndices = new Set<number>()
      for (const key of Object.keys(raw)) {
        const match = key.match(/^entities\[(\d+)]/)
        if (match) entityIndices.add(Number(match[1]))
      }

      for (const index of [...entityIndices].sort()) {
        parsedEntities.push({
          name: raw[`entities[${index}][name]`],
          sequence: raw[`entities[${index}][sequence]`],
          type: raw[`entities[${index}][type]`],
          copies: parseInt(raw[`entities[${index}][copies]`] || '1', 10)
        })
      }

      logger.info(
        `Reconstructed ${parsedEntities.length} entities from multipart form data`
      )
    }
  } catch (parseErr) {
    logger.error('Failed to parse entities_json or reconstruct entities', parseErr)
    return res
      .status(400)
      .json({ message: 'Invalid entities_json or malformed form data' })
  }

  // Check if the number of entities exceeds the maximum allowed
  if (parsedEntities.length > 20) {
    res.status(400).json({ message: 'You can only submit up to 20 entities.' })
    return
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
