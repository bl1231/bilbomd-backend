const { logger } = require('../middleware/loggers')
const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid')
const spawn = require('child_process').spawn
const User = require('../model/User')
const uploadFolder = path.join(process.env.DATA_VOL)
const af2paeUploads = path.join(uploadFolder, 'af2pae_uploads')

const createNewConstFile = async (req, res) => {
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024, //5MB
    uploadDir: af2paeUploads
  })

  const UUID = uuid()

  const jobDir = path.join(form.uploadDir, UUID)

  try {
    await fs.mkdir(jobDir, { recursive: true })
    logger.info('Created Directory: %s', jobDir)
  } catch (error) {
    logger.error(error)
    return res.status(500).json({ message: 'Failed to create job directory' })
  }

  form.on('fileBegin', (fieldName, file) => {
    file.filepath = path.join(jobDir, file.originalFilename)
  })

  form.parse(req, async (err, fields, files) => {
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
      // const newJob = createNewJobObject(fields, files, UUID, user)
      // await newJob.save()

      // logger.info('created new job: %s', newJob.id)

      // await jobQueue.queueJob({
      //   type: 'BilboMD',
      //   title: newJob.title,
      //   uuid: newJob.uuid,
      //   jobid: newJob.id
      // })

      // logger.info('BullMQ task added to queue with UUID: %s', newJob.uuid)

      res.status(200).json({
        message: 'New BilboMD Job successfully created'
      })
    } catch (err) {
      logger.error('Error creating AF2PAE const.inp file:', err)
      console.log(err)
      res.status(500).json({ message: 'Failed to create new AF2PAE const.inp file' })
    }
  })
}

const spawnAF2PAEInpFileMaker = (af2paeDir) => {
  const logFile = path.join(af2paeDir, 'af2pae.log')
  const errorFile = path.join(af2paeDir, 'af2pae_error.log')
  const logStream = fs.createWriteStream(logFile)
  const errorStream = fs.createWriteStream(errorFile)
  return new Promise((resolve, reject) => {
    const af2pae = spawn('python', ['--version'])
    af2pae.stdout?.on('data', (data) => {
      console.log('spawnAF2PAEInpFileMaker stdout', data.toString())
      logStream.write(data.toString())
    })
    af2pae.stderr?.on('data', (data) => {
      console.log('spawnAF2PAEInpFileMaker stderr', data.toString())
      errorStream.write(data.toString())
    })
    af2pae.on('error', (error) => {
      console.log('spawnAF2PAEInpFileMaker error:', error)
      reject(error)
    })
    af2pae.on('exit', (code) => {
      if (code === 0) {
        console.log('spawnAF2PAEInpFileMaker close success exit code:', code)
        resolve(code.toString())
      } else {
        console.log('spawnAF2PAEInpFileMaker close error exit code:', code)
        reject(`spawnAF2PAEInpFileMaker on close reject`)
      }
    })
  })
}

module.exports = {
  createNewConstFile
}
