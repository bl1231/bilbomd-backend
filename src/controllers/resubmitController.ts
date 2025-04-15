import { logger } from '../middleware/loggers.js'
import fs from 'fs-extra'
import path from 'path'
import { Job } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const checkFiles = async (req: Request, res: Response) => {
  const { id } = req.params
  logger.info(`Checking files for job ID: ${id}`)
  if (!id) {
    res.status(400).json({ message: 'Job ID required.' })
    return
  }
  try {
    const job = await Job.findById(id)
    if (!job) {
      res.status(404).json({ message: 'Job not found.' })
      return
    }

    const fieldsToCheck = [
      'psf_file',
      'crd_file',
      'pdb_file',
      'const_inp_file',
      'data_file',
      'pae_file',
      'fasta_file'
    ]
    const fileStatus: Record<string, boolean> = {}

    for (const field of fieldsToCheck) {
      const relPath = (job as unknown as Partial<Record<string, string>>)[field]
      if (typeof relPath === 'string' && relPath.length > 0) {
        const absPath = path.join(uploadFolder, job.uuid, relPath)
        fileStatus[field] = await fs.pathExists(absPath)
      }
    }

    res.status(200).json(fileStatus)
  } catch (error) {
    logger.error(`Error checking files for job ${id}: ${error}`)
    res.status(500).json({ message: 'Internal server error' })
  }
}

export { checkFiles }
