import { logger } from '../../middleware/loggers.js'

import fs from 'fs-extra'

import path from 'path'

import { Job, IJob, MultiJob, IMultiJob } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const deleteJob = async (req: Request, res: Response) => {
  const { id } = req.params

  if (!id) {
    res.status(400).json({ message: 'Job ID required' })
    return
  }

  try {
    // Check if the job is a standard Job or a MultiJob
    const job = await Job.findById(id).exec()
    const multiJob = await MultiJob.findById(id).exec()

    if (!job && !multiJob) {
      res.status(400).json({ message: 'Job not found' })
      return
    }

    if (job) {
      // Handle standard Job deletion
      await handleStandardJobDeletion(job, res)
    } else if (multiJob) {
      // Handle MultiJob deletion
      await handleMultiJobDeletion(multiJob, res)
    }
  } catch (error) {
    logger.error(`Error deleting job: ${error}`)
    res.status(500).json({ message: 'Internal server error during job deletion' })
  }
}

const handleStandardJobDeletion = async (job: IJob, res: Response) => {
  const deleteResult = await job.deleteOne()

  if (!deleteResult) {
    res.status(404).json({ message: 'No job was deleted' })
    return
  }

  await removeJobDirectory(job.uuid, res)

  const reply = `Deleted Job: '${job.title}' with ID ${job._id} and UUID: ${job.uuid}`
  res.status(200).json({ reply })
}

const handleMultiJobDeletion = async (multiJob: IMultiJob, res: Response) => {
  // Delete the MultiJob itself
  const deleteResult = await multiJob.deleteOne()

  if (!deleteResult) {
    res.status(404).json({ message: 'No MultiJob was deleted' })
    return
  }

  await removeJobDirectory(multiJob.uuid, res)

  const reply = `Deleted MultiJob: '${multiJob.title}' with ID ${multiJob._id} and UUID: ${multiJob.uuid}`
  res.status(200).json({ reply })
}

const removeJobDirectory = async (uuid: string, res: Response) => {
  const jobDir = path.join(uploadFolder, uuid)
  try {
    const exists = await fs.pathExists(jobDir)
    if (!exists) {
      logger.warn(`Directory not found on disk for UUID: ${uuid}`)
      return
    }

    const maxAttempts = 10
    let attempt = 0
    const start = Date.now()

    while (attempt < maxAttempts) {
      try {
        logger.info(`Attempt ${attempt + 1} to remove ${jobDir}`)
        await fs.remove(jobDir)
        logger.info(`Removed ${jobDir}`)
        break
      } catch (err) {
        const error = err as NodeJS.ErrnoException // Explicitly cast the error
        if (error.code === 'ENOTEMPTY' || error.code === 'EBUSY') {
          logger.warn(
            `Attempt ${attempt + 1} to remove directory failed: ${
              error.code
            }, retrying...`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          attempt++
        } else {
          throw error // Re-throw if it's an unexpected error
        }
      }
    }

    const end = Date.now()
    const duration = end - start
    logger.info(`Total time to attempt removal of ${jobDir}: ${duration} ms.`)
  } catch (error) {
    logger.error(`Error deleting directory: ${error}`)
    res.status(500).json({ message: 'Error deleting directory' })
  }
}

export {
  deleteJob,
  handleStandardJobDeletion,
  handleMultiJobDeletion,
  removeJobDirectory
}
