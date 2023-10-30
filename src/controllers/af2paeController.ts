import { logger } from '../middleware/loggers'
// import formidable from 'formidable'
import multer from 'multer'
import fs from 'fs-extra'
import path from 'path'
import { Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
// const spawn = require('child_process').spawn

import { spawn, ChildProcess } from 'node:child_process'
import { User } from '../model/User'
const uploadFolder: string = process.env.DATA_VOL ?? '/'

const af2paeUploads = path.join(uploadFolder, 'af2pae_uploads')

/**
 * @openapi
 * /af2pae:
 *   post:
 *     summary: Create a new const file from PAE matrix.
 *     tags:
 *       - Utilities
 *     description: Endpoint for creating a new const file.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email associated with the user.
 *               crd_file:
 *                 type: string
 *                 format: binary
 *                 description: The CRD file to upload.
 *               pae_file:
 *                 type: string
 *                 format: binary
 *                 description: The PAE file to upload.
 *     responses:
 *       '200':
 *         description: Const file created successfully.
 *       '400':
 *         description: Invalid form data.
 */
const createNewConstFile = async (req: Request, res: Response) => {
  const UUID = uuid()
  const jobDir = path.join(af2paeUploads, UUID)

  // const form = formidable({
  //   keepExtensions: false,
  //   allowEmptyFiles: false,
  //   maxFiles: 2,
  //   maxFileSize: 2500 * 1024 * 1024, //25MB
  //   uploadDir: af2paeUploads,
  //   filename: (name, ext, part, form) => {
  //     logger.info('form from host: %s', form.headers.host)
  //     if (part.name == 'crd_file') return path.join(UUID, part.name + '.crd')
  //     if (part.name == 'pae_file') return path.join(UUID, part.name + '.json')
  //   }
  // })

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created Directory: %s', jobDir)

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, jobDir)
      },
      filename: function (req, file, cb) {
        let newFilename
        if (file.fieldname === 'crd_file') {
          newFilename = 'crd_file.crd'
        } else if (file.fieldname === 'pae_file') {
          newFilename = 'pae_file.json'
        } else {
          newFilename = file.fieldname
        }
        cb(null, newFilename)
      }
    })

    const upload = multer({ storage: storage })

    upload.fields([
      { name: 'crd_file', maxCount: 1 },
      { name: 'pae_file', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        logger.error(err)
        return res.status(500).json({ message: 'Failed to upload one or more files' })
      }
      try {
        const { email } = req.body
        const user = await User.findOne({ email }).exec()
        if (!user) {
          return res.status(401).json({ message: 'No user found with that email' })
        }

        await spawnAF2PAEInpFileMaker(jobDir)

        const downloadableConstFile = path.join(UUID, 'const.inp')

        res.status(200).json({
          message: 'New const.inp file successfully created',
          uuid: UUID,
          const_file: downloadableConstFile
        })
      } catch (error) {
        logger.error(`Error creating AF2PAE const.inp file: ${error}`)
        res.status(500).json({ message: 'Error creating AF2PAE const.inp file' })
      }
    })
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create job directory' })
  }
}

/**
 * @openapi
 * /af2pae:
 *   get:
 *     summary: Download Const File
 *     tags:
 *      - Utilities
 *     description: Download the const.inp file associated with a job by its UUID.
 *     parameters:
 *       - in: query
 *         name: uuid
 *         required: true
 *         description: The UUID of the job for which to download the const.inp file.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Const file downloaded successfully.
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad Request. The UUID parameter is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: The error message indicating the missing or invalid UUID.
 *       500:
 *         description: Internal Server Error. Failed to download the const.inp file.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: The error message indicating the failure to download the file.
 */
const downloadConstFile = async (req: Request, res: Response) => {
  const { uuid } = req.query
  if (!uuid) return res.status(400).json({ message: 'Job UUID required.' })
  logger.info(`Request to download ${uuid}`)
  const constFile = path.join(af2paeUploads, uuid.toString(), 'const.inp')
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
    logger.error('No %s available.', constFile)
    return res.status(500).json({ message: `No ${constFile} available.` })
  }
}

const spawnAF2PAEInpFileMaker = (af2paeDir: string) => {
  const logFile = path.join(af2paeDir, 'af2pae.log')
  const errorFile = path.join(af2paeDir, 'af2pae_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const af2pae_script = '/app/scripts/pae_ratios.py'
  const args = [af2pae_script, 'pae_file.json', 'crd_file.crd']

  return new Promise((resolve, reject) => {
    const af2pae: ChildProcess = spawn('python', args, { cwd: af2paeDir })
    af2pae.stdout?.on('data', (data) => {
      logger.info('spawnAF2PAEInpFileMaker stdout %s', data.toString())
      logStream.write(data.toString())
      // const constFileContent = `uuid: ${af2paeDir}`
      // constFileStream.write(constFileContent)
    })
    af2pae.stderr?.on('data', (data) => {
      logger.error('spawnAF2PAEInpFileMaker stderr', data.toString())
      console.log(data)
      errorStream.write(data.toString())
    })
    af2pae.on('error', (error) => {
      logger.error('spawnAF2PAEInpFileMaker error:', error)
      reject(error)
    })
    af2pae.on('exit', (code) => {
      if (code === 0) {
        logger.info('spawnAF2PAEInpFileMaker close success exit code:', code)
        resolve(code.toString())
      } else {
        logger.error('spawnAF2PAEInpFileMaker close error exit code:', code)
        reject(`spawnAF2PAEInpFileMaker on close reject`)
      }
    })
  })
}

export { createNewConstFile, downloadConstFile }
