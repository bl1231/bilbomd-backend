import { logger } from '../../middleware/loggers.js'
import fs from 'fs-extra'
import path from 'path'
import { queueJob } from '../../queues/bilbomd.js'
import { IUser, JobStatus, StepStatus } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { writeJobParams, sanitizeConstInpFile } from './utils/jobUtils.js'
import { resolveResubmissionFiles } from './utils/resolveResubmissionFiles.js'
import { maybeAutoCalculateRg } from './utils/maybeAutoCalculateRg.js'
import { buildBilboMdJob } from './utils/buildBilboMdJob.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const handleBilboMDJob = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  try {
    const isResubmission = req.body.resubmit === 'false'
    const originalJobId = req.body.original_job_id || null
    logger.info(`isResubmission: ${isResubmission}, originalJobId: ${originalJobId}`)

    const { bilbomd_mode: bilbomdMode, title, num_conf } = req.body
    let { rg, rg_min, rg_max } = req.body

    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    logger.info(`bilbomdMode: ${bilbomdMode}`)
    logger.info(`title: ${title}`)

    let constInpFile = ''
    let dataFile = ''
    let extraFiles: Record<string, string> = {}

    if (isResubmission && originalJobId) {
      try {
        const result = await resolveResubmissionFiles(originalJobId, UUID)
        constInpFile = result.constInpFile
        dataFile = result.dataFile
        extraFiles = result.extraFiles
      } catch (err) {
        logger.error(err)
        res.status(404).json({
          message: err instanceof Error ? err.message : 'An unknown error occurred'
        })
        return
      }
    } else {
      constInpFile = files['inp_file']?.[0]?.originalname.toLowerCase()
      dataFile = files['dat_file']?.[0]?.originalname.toLowerCase()

      const jobDir = path.join(uploadFolder, UUID)
      const constInpFilePath = path.join(jobDir, constInpFile)
      const constInpOrigFilePath = path.join(jobDir, `${constInpFile}.orig`)
      await fs.copyFile(constInpFilePath, constInpOrigFilePath)
      await sanitizeConstInpFile(constInpFilePath)

      extraFiles = {
        psf_file: files['psf_file']?.[0]?.originalname.toLowerCase() || '',
        crd_file: files['crd_file']?.[0]?.originalname.toLowerCase() || '',
        pdb_file: files['pdb_file']?.[0]?.originalname.toLowerCase() || ''
      }
    }

    // Initialize common job data
    const commonJobData = {
      title,
      uuid: UUID,
      status: JobStatus.Submitted,
      data_file: dataFile,
      time_submitted: new Date(),
      user,
      progress: 0,
      cleanup_in_progress: false,
      steps: {
        minimize: { status: StepStatus.Waiting, message: '' },
        initfoxs: { status: StepStatus.Waiting, message: '' },
        heat: { status: StepStatus.Waiting, message: '' },
        md: { status: StepStatus.Waiting, message: '' },
        dcd2pdb: { status: StepStatus.Waiting, message: '' },
        pdb_remediate: { status: StepStatus.Waiting, message: '' },
        foxs: { status: StepStatus.Waiting, message: '' },
        multifoxs: { status: StepStatus.Waiting, message: '' },
        results: { status: StepStatus.Waiting, message: '' },
        email: { status: StepStatus.Waiting, message: '' }
      }
    }

    const jobDir = path.join(uploadFolder, UUID)

    // Calculate rg values if not provided
    const resolvedRgValues = await maybeAutoCalculateRg(
      { rg, rg_min, rg_max },
      !!req.apiUser,
      jobDir,
      dataFile
    )

    rg = resolvedRgValues.rg
    rg_min = resolvedRgValues.rg_min
    rg_max = resolvedRgValues.rg_max

    logger.info(`Creating job for bilbomd_mode: ${bilbomdMode}`)
    logger.info(`const_inp_file being passed: "${constInpFile}"`)
    if (!constInpFile) {
      throw new Error('constInpFile is undefined or empty')
    }
    const newJob = buildBilboMdJob(bilbomdMode, commonJobData, {
      pdb_file: extraFiles.pdb_file as string | undefined,
      psf_file: extraFiles.psf_file as string | undefined,
      crd_file: extraFiles.crd_file as string | undefined,
      const_inp_file: constInpFile,
      conformational_sampling: num_conf,
      rg,
      rg_min,
      rg_max,
      ...(isResubmission && originalJobId ? { resubmitted_from: originalJobId } : {})
    })

    // logger.info(`New job created: ${newJob}`)

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

export { handleBilboMDJob }
