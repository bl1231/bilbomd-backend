import { logger } from '../middleware/loggers.js'
import mongoose from 'mongoose'
import fs from 'fs-extra'
import path from 'path'
import { Job, MultiJob } from '@bl1231/bilbomd-mongodb-schema'
import { Request, Response } from 'express'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const updateJobStatus = async (req: Request, res: Response) => {
  const { id, email, status } = req.body

  // Confirm data
  if (!id || !email || !status) {
    res.status(400).json({ message: 'All fields are required' })
  }

  // Confirm job exists to update
  const job = await Job.findById(id).exec()

  if (!job) {
    res.status(400).json({ message: 'Job not found' })
    return
  }

  // Check current status
  if (job.status == status) {
    res.status(400).json({ message: `nothing to do - status already ${job.status}` })
  }

  if (job.status == status) {
    res.status(400).json({ message: 'nothing to do' })
  }

  // Go ahead and update status
  job.status = status

  const updatedJob = await job.save()

  res.json(`'${updatedJob.title}' updated`)
}

const downloadJobResults = async (req: Request, res: Response) => {
  const { id } = req.params

  if (!id) {
    res.status(400).json({ message: 'Job ID required.' })
    return
  }

  try {
    // Find the job in either Job or MultiJob collection
    const job = await Job.findById(id).exec()
    const multiJob = await MultiJob.findById(id).exec()

    if (!job && !multiJob) {
      res.status(404).json({ message: `No job matches ID ${id}.` })
      return
    }

    // Determine the result file path based on job type
    const { uuid } = job || multiJob!
    const outputFolder = path.join(uploadFolder, uuid)
    const uuidPrefix = uuid.split('-')[0]

    // Possible result file paths
    const possiblePaths = [
      path.join(outputFolder, `results-${uuidPrefix}.tar.gz`),
      path.join(outputFolder, `results.tar.gz`)
    ]

    let resultFilePath: string | null = null

    // Check for the first existing file
    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath)
        resultFilePath = filePath
        break
      } catch (error) {
        logger.warn(`Results file not found at ${filePath} ${error}`)
      }
    }

    if (!resultFilePath) {
      res.status(404).json({ message: 'Results file not found.' })
      return
    }

    // Set headers and initiate file download
    const filename = path.basename(resultFilePath)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.download(resultFilePath, filename, (err) => {
      if (err) {
        logger.error(`Error during file download: ${err}`)
        res.status(500).json({ message: `Could not download the file: ${err.message}` })
      }
    })
  } catch (error) {
    logger.error(`Error retrieving job: ${error}`)
    res.status(500).json({ message: 'An error occurred while processing your request.' })
  }
}

const getLogForStep = async (req: Request, res: Response) => {
  if (!req?.params?.id) res.status(400).json({ message: 'Job ID required.' })
  // Check if req.params.id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ message: 'Invalid Job ID format.' })
    return
  }
  const job = await Job.findOne({ _id: req.params.id }).exec()
  if (!job) {
    res.status(204).json({ message: `No job matches ID ${req.params.id}.` })
    return
  }
  const step = req.query.step
  let logFile: string = ''
  switch (step) {
    case 'minimize':
      logFile = path.join(uploadFolder, job.uuid, 'minimize.out')
      break
    case 'heat':
      logFile = path.join(uploadFolder, job.uuid, 'heat.out')
      break
    default:
      res.status(200).json({
        logContent: `Cannot retrieve error logs for ${step} step.\n please contact SIBYLS staff\n`
      })
  }

  fs.readFile(logFile, 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occurred while reading the file
      res.status(500).json({ message: 'Error reading log file' })
    }

    // Send the log file content in a JSON response
    res.status(200).json({ logContent: data })
  })
}

export { updateJobStatus, downloadJobResults, getLogForStep }
