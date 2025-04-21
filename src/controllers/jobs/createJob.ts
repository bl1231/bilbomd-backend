import { logger } from '../../middleware/loggers.js'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { handleBilboMDJob } from './handleBilboMDJob.js'
import { handleBilboMDAutoJob } from './handleBilboMDAutoJob.js'
import { handleBilboMDScoperJob } from './handleBilboMDScoperJob.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const createNewJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)
  // console.log('req.apiUser: ', req.apiUser)
  const email = req.apiUser?.email

  try {
    // Create the job directory
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Created directory: ${jobDir}`)

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, jobDir),
      filename: (req, file, cb) => cb(null, file.originalname.toLowerCase())
    })

    const upload = multer({ storage: storage })

    upload.fields([
      { name: 'bilbomd_mode', maxCount: 1 },
      { name: 'psf_file', maxCount: 1 },
      { name: 'pdb_file', maxCount: 1 },
      { name: 'crd_file', maxCount: 1 },
      { name: 'inp_file', maxCount: 1 },
      { name: 'dat_file', maxCount: 1 },
      { name: 'pae_file', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        logger.error('multer error:', err)
        res.status(500).json({ message: 'Failed to upload one or more files' })
        return
      }

      try {
        const { bilbomd_mode } = req.body

        if (!bilbomd_mode) {
          res.status(400).json({ message: 'No job type provided' })
          return
        }

        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          res.status(401).json({ message: 'No user found with that email' })
          return
        }

        // Update jobCount and jobTypes
        const jobTypeField = `jobTypes.${bilbomd_mode}`
        await User.findByIdAndUpdate(foundUser._id, {
          $inc: { jobCount: 1, [jobTypeField]: 1 }
        })

        // Route to the appropriate handler
        logger.info(`Handling BilboMDJob: ${bilbomd_mode}`)
        if (bilbomd_mode === 'pdb' || bilbomd_mode === 'crd_psf') {
          await handleBilboMDJob(req, res, foundUser, UUID)
        } else if (bilbomd_mode === 'auto') {
          logger.info('Handling BilboMDAutoJob')
          await handleBilboMDAutoJob(req, res, foundUser, UUID)
        } else if (bilbomd_mode === 'scoper') {
          logger.info('Handling BilboMDScoperJob')
          await handleBilboMDScoperJob(req, res, foundUser, UUID)
        } else {
          res.status(400).json({ message: 'Invalid job type' })
          return
        }
      } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Internal server error' })
      }
    })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ message: 'Failed to create job directory' })
  }
}

export { createNewJob }
