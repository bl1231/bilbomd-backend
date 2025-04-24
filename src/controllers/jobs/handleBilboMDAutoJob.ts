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
import { ValidationError } from 'yup'
import { AutoRgResults } from '../../types/bilbomd.js'
import { writeJobParams } from './utils/jobUtils.js'
import { spawnAutoRgCalculator } from './utils/autoRg.js'
import fs from 'fs-extra'
import { autoJobSchema } from '../../validation/index.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const handleBilboMDAutoJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const isResubmission = req.body.resubmit === 'true'
    const originalJobId = req.body.original_job_id || null
    logger.info(`isResubmission: ${isResubmission}, originalJobId: ${originalJobId}`)

    const { bilbomd_mode: bilbomdMode } = req.body

    let pdbFileName = ''
    let paeFileName = ''
    let datFileName = ''
    let pdbFile
    let paeFile
    let datFile

    const jobDir = path.join(uploadFolder, UUID)

    if (isResubmission && originalJobId) {
      const originalJob = await BilboMdAutoJob.findById(originalJobId)
      if (!originalJob) {
        res.status(404).json({ message: 'Original job not found' })
        return
      }

      const originalDir = path.join(uploadFolder, originalJob.uuid)
      pdbFileName = originalJob.pdb_file
      paeFileName = originalJob.pae_file
      datFileName = originalJob.data_file

      await fs.copy(path.join(originalDir, pdbFileName), path.join(jobDir, pdbFileName))
      await fs.copy(path.join(originalDir, paeFileName), path.join(jobDir, paeFileName))
      await fs.copy(path.join(originalDir, datFileName), path.join(jobDir, datFileName))
      logger.info(
        `Resubmission: Copied files from original job ${originalJobId} to new job ${UUID}`
      )
    } else {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      pdbFile = files['pdb_file']?.[0]
      paeFile = files['pae_file']?.[0]
      datFile = files['dat_file']?.[0]
      pdbFileName = files['pdb_file']?.[0]?.originalname.toLowerCase()
      paeFileName = files['pae_file']?.[0]?.originalname.toLowerCase()
      datFileName = files['dat_file']?.[0]?.originalname.toLowerCase()
    }

    logger.info(`PDB File: ${pdbFileName}`)
    logger.info(`PAE File: ${paeFileName}`)

    const autorgResults: AutoRgResults = await spawnAutoRgCalculator(jobDir, datFileName)

    // Collect data for validation
    const jobPayload = {
      title: req.body.title,
      bilbomd_mode: bilbomdMode,
      email: req.body.email,
      pdb_file: pdbFile,
      pae_file: paeFile,
      dat_file: datFile,
      rg: autorgResults.rg,
      rg_min: autorgResults.rg_min,
      rg_max: autorgResults.rg_max
    }

    // Validate the job payload
    try {
      await autoJobSchema.validate(jobPayload, { abortEarly: false })
    } catch (validationErr) {
      if (validationErr instanceof ValidationError) {
        logger.warn('Classic PDB job payload validation failed', validationErr)
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
      time_submitted: new Date(),
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
      },
      ...(isResubmission && originalJobId ? { resubmitted_from: originalJobId } : {})
    })

    // Save the job to the database
    await newJob.save()
    logger.info(`BilboMD-${req.body.bilbomd_mode} Job saved to MongoDB: ${newJob.id}`)

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
      type: req.body.bilbomd_mode,
      title: newJob.title,
      uuid: newJob.uuid,
      jobid: newJob.id
    })

    logger.info(`${req.body.bilbomd_mode} Job assigned UUID: ${newJob.uuid}`)
    logger.info(`${req.body.bilbomd_mode} Job assigned BullMQ ID: ${BullId}`)

    res.status(200).json({
      message: `New ${req.body.bilbomd_mode} Job ${newJob.title} successfully created`,
      jobid: newJob.id,
      uuid: newJob.uuid
    })
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown error occurred'

    logger.error('handleBilboMDJob error:', error)
    res.status(500).json({ message: msg })
  }
}

export { handleBilboMDAutoJob }
