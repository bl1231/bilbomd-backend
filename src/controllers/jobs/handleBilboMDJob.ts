import { logger } from '../../middleware/loggers.js'
import fs from 'fs-extra'
import path from 'path'
import { queueJob } from '../../queues/bilbomd.js'
import {
  Job,
  IUser,
  BilboMdPDBJob,
  IBilboMDPDBJob,
  BilboMdCRDJob,
  IBilboMDCRDJob,
  IBilboMDSteps
} from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { writeJobParams, sanitizeConstInpFile } from './jobUtils.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const handleBilboMDJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const isResubmission = req.body.resubmit === 'true'
    const originalJobId = req.body.original_job_id || null
    logger.info(`isResubmission: ${isResubmission}, originalJobId: ${originalJobId}`)

    const { bilbomd_mode: bilbomdMode, title, num_conf, rg, rg_min, rg_max } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(`bilbomdMode: ${bilbomdMode}`)
    logger.info(`title: ${title}`)

    let constInpFile = ''
    let dataFile = ''

    if (isResubmission && originalJobId) {
      const originalJob = (await Job.findById(originalJobId)) as
        | IBilboMDPDBJob
        | IBilboMDCRDJob
      if (!originalJob) {
        res.status(404).json({ message: 'Original job not found' })
        return
      }

      const originalDir = path.join(uploadFolder, originalJob.uuid)
      const newDir = path.join(uploadFolder, UUID)

      constInpFile = originalJob.const_inp_file
      dataFile = originalJob.data_file

      await fs.copy(path.join(originalDir, constInpFile), path.join(newDir, constInpFile))
      await fs.copy(path.join(originalDir, dataFile), path.join(newDir, dataFile))
      logger.info(
        `Resubmission: Copied files from original job ${originalJobId} to new job ${UUID}`
      )
    } else {
      constInpFile = files['inp_file']?.[0]?.originalname.toLowerCase()
      dataFile = files['dat_file']?.[0]?.originalname.toLowerCase()

      const jobDir = path.join(uploadFolder, UUID)
      const constInpFilePath = path.join(jobDir, constInpFile)
      const constInpOrigFilePath = path.join(jobDir, `${constInpFile}.orig`)
      await fs.copyFile(constInpFilePath, constInpOrigFilePath)
      await sanitizeConstInpFile(constInpFilePath)
    }

    // Initialize common job data
    const commonJobData = {
      __t: '',
      title,
      uuid: UUID,
      status: 'Submitted',
      data_file: dataFile,
      const_inp_file: constInpFile,
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
    logger.info(`Creating job for bilbomd_mode: ${bilbomdMode}`)
    if (bilbomdMode === 'crd_psf') {
      let psfFile = ''
      let crdFile = ''

      if (isResubmission && originalJobId) {
        const originalJob = (await Job.findById(originalJobId)) as IBilboMDCRDJob
        if (!originalJob) {
          res.status(404).json({ message: 'Original CRD job not found' })
          return
        }
        psfFile = originalJob.psf_file
        crdFile = originalJob.crd_file

        const originalDir = path.join(uploadFolder, originalJob.uuid)
        const newDir = path.join(uploadFolder, UUID)
        await fs.copy(path.join(originalDir, psfFile), path.join(newDir, psfFile))
        await fs.copy(path.join(originalDir, crdFile), path.join(newDir, crdFile))
      } else {
        psfFile = files['psf_file']?.[0]?.originalname.toLowerCase() || ''
        crdFile = files['crd_file']?.[0]?.originalname.toLowerCase() || ''
      }

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
      let pdbFile = ''

      if (isResubmission && originalJobId) {
        const originalJob = (await Job.findById(originalJobId)) as IBilboMDPDBJob
        if (!originalJob) {
          res.status(404).json({ message: 'Original PDB job not found' })
          return
        }
        pdbFile = originalJob.pdb_file

        const originalDir = path.join(uploadFolder, originalJob.uuid)
        const newDir = path.join(uploadFolder, UUID)
        await fs.copy(path.join(originalDir, pdbFile), path.join(newDir, pdbFile))
      } else {
        pdbFile = files['pdb_file']?.[0]?.originalname.toLowerCase() || ''
      }

      newJob = new BilboMdPDBJob({
        ...commonJobData,
        __t: 'BilboMdPDB',
        pdb_file: pdbFile,
        conformational_sampling: num_conf,
        rg,
        rg_min,
        rg_max,
        steps: { ...commonJobData.steps, pdb2crd: {} },
        ...(isResubmission && originalJobId ? { resubmitted_from: originalJobId } : {})
      })
    }

    // Handle unsupported modes
    if (!newJob) {
      logger.error(`Unsupported bilbomd_mode: ${bilbomdMode}`)
      res.status(400).json({ message: 'Invalid bilbomd_mode specified' })
      return
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

export { handleBilboMDJob }
