import { logger } from '../../middleware/loggers.js'
import { config } from '../../config/config.js'
import path from 'path'
import { queueJob } from '../../queues/bilbomd.js'
import {
  queueJob as queuePdb2CrdJob,
  waitForJobCompletion,
  pdb2crdQueueEvents
} from '../../queues/pdb2crd.js'
import { IUser, BilboMdAutoJob, IBilboMDAutoJob } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { AutoRgResults } from '../../types/bilbomd.js'
import { writeJobParams } from './jobUtils.js'
import { spawnAutoRgCalculator } from './autoRg.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

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

export { handleBilboMDAutoJob }
