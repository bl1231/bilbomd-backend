import { logger } from '../middleware/loggers.js'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { spawn, ChildProcess } from 'node:child_process'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { queueJob, waitForJobCompletion, pdb2crdQueueEvents } from '../queues/pdb2crd.js'

const uploadFolder: string = process.env.DATA_VOL ?? '/bilbomd/uploads'

const createNewConstFile = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(uploadFolder, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info(`Created Directory: ${jobDir}`)

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, jobDir)
      },
      filename: function (req, file, cb) {
        // let newFilename
        // if (file.fieldname === 'pdb_file') {
        //   newFilename = 'pdb_file.pdb'
        // } else if (file.fieldname === 'pae_file') {
        //   newFilename = 'pae_file.json'
        // } else {
        //   newFilename = file.fieldname
        // }
        cb(null, file.originalname.toLowerCase())
      }
    })

    const upload = multer({ storage: storage })

    upload.fields([
      { name: 'pdb_file', maxCount: 1 },
      { name: 'pae_file', maxCount: 1 },
      { name: 'pae_power', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        return res.status(500).json({ message: 'Failed to upload one or more files' })
      }
      try {
        const { email, pae_power } = req.body
        const user = await User.findOne({ email }).exec()
        if (!user) {
          return res.status(401).json({ message: 'No user found with that email' })
        }
        const files = req.files as { [fieldname: string]: Express.Multer.File[] }
        const pdbFileName =
          files['pdb_file'] && files['pdb_file'][0]
            ? files['pdb_file'][0].originalname.toLowerCase()
            : 'missing.pdb'
        const paeFileName =
          files['pae_file'] && files['pae_file'][0]
            ? files['pae_file'][0].originalname.toLowerCase()
            : 'missing.json'

        const BullId = await queueJob({
          type: 'Pdb2Crd',
          title: 'convert PDB to CRD',
          uuid: UUID,
          pdb_file: pdbFileName,
          pae_power: pae_power
        })
        logger.info(`Pdb2Crd Job assigned UUID: ${UUID}`)
        logger.info(`Pdb2Crd Job assigned BullMQ ID: ${BullId}`)

        // Need to wait here until the BullMQ job is finished
        await waitForJobCompletion(BullId, pdb2crdQueueEvents)

        // I should try using the pae_ratios.py on worker instead of backend
        // so we can have only a single version of teh script.

        await spawnAF2PAEInpFileMaker(jobDir, paeFileName, pae_power)

        res.status(200).json({
          message: 'New const.inp file successfully created',
          uuid: UUID
        })
      } catch (error) {
        logger.error(`Error queueing PDB2CRD conversion: ${error}`)
        res.status(500).json({ message: 'Error queueing PDB2CRD conversion' })
      }
    })
  } catch (error) {
    logger.error(`Failed to create job directory: ${error}`)
    return res.status(500).json({ message: 'Failed to create job directory' })
  }
}

const downloadConstFile = async (req: Request, res: Response) => {
  const { uuid } = req.query
  if (!uuid) return res.status(400).json({ message: 'Job UUID required.' })
  logger.info(`Request to download ${uuid}`)
  const constFile = path.join(uploadFolder, uuid.toString(), 'const.inp')
  try {
    await fs.promises.access(constFile)
    res.download(constFile, (err) => {
      if (err) {
        res.status(500).json({
          message: 'Could not download the file . ' + err
        })
      }
    })
  } catch (error) {
    logger.error(`No ${constFile} available. ${error}`)
    return res.status(500).json({ message: `No ${constFile} available.` })
  }
}

const spawnAF2PAEInpFileMaker = (
  af2paeDir: string,
  paeFile: string,
  paePower: string
) => {
  logger.info(`spawnAF2PAEInpFileMaker af2paeDir ${af2paeDir}`)
  const logFile = path.join(af2paeDir, 'af2pae.log')
  const errorFile = path.join(af2paeDir, 'af2pae_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const af2pae_script = '/app/scripts/pae_ratios.py'
  const args = [af2pae_script, paeFile, 'bilbomd_pdb2crd.crd', '--pae_power', paePower]

  return new Promise((resolve, reject) => {
    const af2pae: ChildProcess = spawn('python', args, { cwd: af2paeDir })
    af2pae.stdout?.on('data', (data: Buffer) => {
      const dataString = data.toString().trim()
      logger.info(`spawnAF2PAEInpFileMaker stdout ${dataString}`)
      logStream.write(dataString)
    })
    af2pae.stderr?.on('data', (data: Buffer) => {
      logger.error(`spawnAF2PAEInpFileMaker stderr:  ${data.toString()}`)
      console.log(data)
      errorStream.write(data.toString())
    })
    af2pae.on('error', (error) => {
      logger.error(`spawnAF2PAEInpFileMaker error ${error}`)
      reject(error)
    })
    af2pae.on('exit', (code) => {
      // Close streams explicitly once the process exits
      const closeStreamsPromises = [
        new Promise((resolveStream) => logStream.end(resolveStream)),
        new Promise((resolveStream) => errorStream.end(resolveStream))
      ]
      Promise.all(closeStreamsPromises)
        .then(() => {
          // Only proceed once all streams are closed
          if (code === 0) {
            logger.info(`spawnAF2PAEInpFileMaker success with exit code: ${code}`)
            resolve(code.toString())
          } else {
            logger.error(`spawnAF2PAEInpFileMaker error with exit code: ${code}`)
            reject(new Error(`spawnAF2PAEInpFileMaker error with exit code: ${code}`))
          }
        })
        .catch((streamError) => {
          logger.error(`Error closing file streams: ${streamError}`)
          reject(streamError)
        })
    })
  })
}

export { createNewConstFile, downloadConstFile }
