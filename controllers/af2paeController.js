const { logger } = require('../middleware/loggers')
const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid')
const spawn = require('child_process').spawn
const User = require('../model/User')
const uploadFolder = path.join(process.env.DATA_VOL)
const af2paeUploads = path.join(uploadFolder, 'af2pae_uploads')

/**
 * @openapi
 * /af2pae:
 *   post:
 *     summary: Create a new const file from PAE matrix.
 *     tags:
 *       - Const File Utilities
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
const createNewConstFile = async (req, res) => {
  const UUID = uuid()

  const form = formidable({
    keepExtensions: false,
    allowEmptyFiles: false,
    maxFiles: 2,
    maxFileSize: 2500 * 1024 * 1024, //25MB
    uploadDir: af2paeUploads,
    filename: (name, ext, part, form) => {
      logger.info('form from host: %s', form.headers.host)
      if (part.name == 'crd_file') return path.join(UUID, part.name + '.crd')
      if (part.name == 'pae_file') return path.join(UUID, part.name + '.json')
    }
  })

  const jobDir = path.join(af2paeUploads, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created Directory: %s', jobDir)
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create job directory' })
  }

  // form.on('fileBegin', (fieldName, file) => {
  //   // console.log('got file: ', file.originalFilename)
  //   file.filepath = path.join(jobDir, file.originalFilename)
  // })

  form.parse(req, async (err, fields) => {
    if (err) {
      logger.error('Error parsing files %s', err)
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      })
    }

    try {
      const { email } = fields
      const user = await User.findOne({ email }).exec()
      if (!user) {
        return res.status(401).json({ message: 'No user found with that email' })
      }

      await spawnAF2PAEInpFileMaker(jobDir)

      const downloadableConstFile = path.join(UUID, 'const.inp')

      res.status(200).json({
        message: 'New BilboMD Job successfully created',
        uuid: UUID,
        const_file: downloadableConstFile
      })
    } catch (error) {
      logger.error('Error creating AF2PAE const.inp file:', error)
      res
        .status(500)
        .json({ message: 'Failed to create new AF2PAE const.inp file', error: error })
    }
  })
}

/**
 * @openapi
 * /af2pae:
 *   get:
 *     summary: Download Const File
 *     tags:
 *      - Const File Utilities
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
const downloadConstFile = async (req, res) => {
  const { uuid } = req.query
  if (!uuid) return res.status(400).json({ message: 'Job UUID required.' })
  logger.info('request to download %s', uuid)
  const constFile = path.join(af2paeUploads, uuid, 'const.inp')
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

const spawnAF2PAEInpFileMaker = (af2paeDir) => {
  const logFile = path.join(af2paeDir, 'af2pae.log')
  const errorFile = path.join(af2paeDir, 'af2pae_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  const af2pae_script = '/app/scripts/pae_ratios.py'
  const args = [af2pae_script, 'pae_file.json', 'crd_file.crd']

  return new Promise((resolve, reject) => {
    const af2pae = spawn('python', args, { cwd: af2paeDir })
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

module.exports = {
  createNewConstFile,
  downloadConstFile
}
