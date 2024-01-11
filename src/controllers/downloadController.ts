import { logger } from '../middleware/loggers'
import fs from 'fs-extra'
import path from 'path'
import { Job } from '../model/Job'
// eslint-disable-next-line no-unused-vars
import { Express, Request, Response } from 'express'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

const downloadPDB = async (req: Request, res: Response) => {
  const jobId = req.params.id
  const pdbFilename = req.params.pdb
  if (!jobId) return res.status(400).json({ message: 'Job ID required.' })
  if (!pdbFilename) return res.status(400).json({ message: 'PDB filename required.' })
  logger.info(`looking up job: ${jobId}`)
  const job = await Job.findOne({ _id: jobId }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${jobId}.` })
  }
  const pdbFile = path.join(uploadFolder, job.uuid, 'results', pdbFilename)

  try {
    await fs.promises.access(pdbFile)
    res.sendFile(pdbFile, (err) => {
      if (err) {
        res.status(500).json({
          message: 'Could not download the file . ' + err
        })
      } else {
        logger.info(`File ${pdbFilename} sent successfully.`)
      }
    })
  } catch (error) {
    logger.error(`No ${pdbFile} available.`)
    return res.status(500).json({ message: `No ${pdbFile} available.` })
  }
}

export { downloadPDB }
