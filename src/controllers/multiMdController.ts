import { logger } from '../middleware/loggers.js'
import { config } from '../config/config.js'
// import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs-extra'
// import os from 'os'
// import readline from 'readline'
import path from 'path'
import { v4 as uuid, validate as uuidValidate, version as uuidVersion } from 'uuid'
// import { spawn } from 'child_process'
// import { queueJob, getBullMQJob } from '../queues/bilbomd.js'
// import { queueScoperJob, getBullMQScoperJob } from '../queues/scoper.js'
// import {
//   queueJob as queuePdb2CrdJob,
//   waitForJobCompletion,
//   pdb2crdQueueEvents
// } from '../queues/pdb2crd.js'
import { User, IUser, MultiJob } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'
// import { ChildProcess } from 'child_process'
// import { BilboMDScoperSteps, BilboMDSteps } from '../types/bilbomd.js'
// import { BilboMDJob, BilboMDBullMQ } from '../types/bilbomd.js'

const createNewMultiJob = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(config.uploadDir, UUID)
  let user: IUser

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Created directory: ${jobDir}`)

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, jobDir)
      },
      filename: function (req, file, cb) {
        cb(null, file.originalname.toLowerCase())
      }
    })

    const upload = multer({ storage: storage })

    upload.fields([{ name: 'bilbomdUUIDs', maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        return res.status(500).json({ message: 'Failed to upload one or more files' })
      }
      try {
        const email = req.email

        const foundUser = await User.findOne({ email }).exec()
        if (!foundUser) {
          return res.status(401).json({ message: 'No user found with that email' })
        }

        user = foundUser

        await handleBilboMDMultiJobCreation(req, res, user, UUID)
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

const handleBilboMDMultiJobCreation = async (
  req: Request,
  res: Response,
  user: IUser,
  UUID: string
) => {
  logger.info(`Processing MultiJob creation for UUID: ${UUID}`)

  const bilbomdUUIDs = req.body.bilbomdUUIDs

  // Validate `bilbomdUUIDs` is an array and has at least two elements
  if (!Array.isArray(bilbomdUUIDs) || bilbomdUUIDs.length < 2) {
    return res
      .status(400)
      .json({ message: 'bilbomdUUIDs must be an array of at least 2 UUIDs' })
  }

  // Validate each UUID in the array
  const invalidUUIDs = bilbomdUUIDs.filter(
    (id) => !uuidValidate(id) || uuidVersion(id) !== 4
  )

  if (invalidUUIDs.length > 0) {
    return res.status(400).json({
      message: `Invalid UUIDs detected: ${invalidUUIDs.join(
        ', '
      )}. All bilbomdUUIDs must be valid v4 UUIDs.`
    })
  }

  try {
    // Create the MultiJob entry in MongoDB
    const newMultiJob = new MultiJob({
      title: req.body.title,
      uuid: UUID,
      bilbomd_uuids: bilbomdUUIDs,
      user: user._id,
      status: 'Submitted',
      time_submitted: new Date()
    })

    await newMultiJob.save()
    logger.info(`New MultiJob created with UUID: ${UUID}`)

    return res.status(201).json({ message: 'MultiJob created successfully', uuid: UUID })
  } catch (error) {
    logger.error(`Failed to create MultiJob: ${error}`)
    return res.status(500).json({ message: 'Failed to create MultiJob entry' })
  }
}

export { createNewMultiJob }
