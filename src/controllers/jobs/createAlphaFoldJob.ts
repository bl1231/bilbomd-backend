import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs-extra'
import { logger } from '../../middleware/loggers.js'
import multer from 'multer'
import { IAlphaFoldEntity } from '@bl1231/bilbomd-mongodb-schema'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
import { createFastaFile } from './utils/createFastaFile.js'
import { handleBilboMDAlphaFoldJob } from './handleBilboMDAlphaFoldJob.js'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const createNewAlphaFoldJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Created directory: ${jobDir}`)

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, jobDir),
      filename: (req, file, cb) => cb(null, file.originalname.toLowerCase())
    })

    const upload = multer({ storage: storage })

    upload.fields([{ name: 'dat_file', maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        res.status(500).json({ message: 'Failed to upload one or more files' })
        return
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
          res.status(400).json({ message: 'You can only submit up to 20 entities.' })
          return
        }

        const foundUser = await User.findOne({ email }).exec()

        if (!foundUser) {
          res.status(401).json({ message: 'No user found with that email' })
          return
        }

        if (!bilbomd_mode) {
          res.status(400).json({ message: 'No job type provided' })
          return
        }

        // Update jobCount and jobTypes
        const jobTypeField = `jobTypes.${bilbomd_mode}`
        await User.findByIdAndUpdate(foundUser._id, {
          $inc: { jobCount: 1, [jobTypeField]: 1 }
        })

        // Create the FASTA file
        await createFastaFile(parsedEntities, jobDir)

        // Handle the job creation
        await handleBilboMDAlphaFoldJob(req, res, foundUser, UUID, parsedEntities)
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

export { createNewAlphaFoldJob }
