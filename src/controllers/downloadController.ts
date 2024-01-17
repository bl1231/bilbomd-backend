import { logger } from '../middleware/loggers'
import fs from 'fs-extra'
import path from 'path'
import { Job } from '../model/Job'
import { IJob, IBilboMDJob, IBilboMDAutoJob, IBilboMDScoperJob } from '../model/Job'
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

const getFoxsData = async (req: Request, res: Response) => {
  const jobId = req.params.id
  if (!jobId) return res.status(400).json({ message: 'Job ID required.' })
  const job = await Job.findOne({ _id: jobId }).exec()
  if (!job) {
    return res.status(204).json({ message: `No job matches ID ${jobId}.` })
  }
  // Type assertion based on the __t field
  let typedJob: IJob | IBilboMDJob | IBilboMDAutoJob | IBilboMDScoperJob
  if (job.__t === 'BilboMd' || job.__t === 'BilboMdAuto') {
    typedJob = job as IBilboMDJob | IBilboMDAutoJob
  } else if (job.__t === 'BilboMdScoper') {
    typedJob = job as IBilboMDScoperJob
  } else {
    // eslint-disable-next-line no-unused-vars
    typedJob = job // Default to base IJob if none of the specific types match
  }
  if (typedJob.__t === 'BilboMdScoper' && 'pdb_file' in typedJob) {
    const datFileBase = typedJob.data_file.split('.')[0]
    const pdbFileBase = typedJob.pdb_file.split('.')[0]
    const topKFile = path.join(uploadFolder, job.uuid, 'top_k_dirname.txt')
    const pdbNumber = await readTopKNum(topKFile)
    const originalDat = path.join(
      uploadFolder,
      job.uuid,
      'foxs_analysis',
      `${pdbFileBase}_${datFileBase}.dat`
    )
    const scoperDat = path.join(
      uploadFolder,
      job.uuid,
      'foxs_analysis',
      `scoper_combined_newpdb_${pdbNumber}_${datFileBase}.dat`
    )
    const originalDatContent = fs.readFileSync(originalDat, 'utf8')
    const scoperDatContent = fs.readFileSync(scoperDat, 'utf8')

    const dataFromOrig = parseFileContent(originalDatContent)
    const dataFromScop = parseFileContent(scoperDatContent)

    const chisqFromOrig = extractChiSquared(originalDatContent)
    const chisqFromScop = extractChiSquared(scoperDatContent)

    const data = [
      { filename: typedJob.pdb_file, chisq: chisqFromOrig, data: dataFromOrig },
      {
        filename: `scoper_combined_newpdb_${pdbNumber}.pdb`,
        chisq: chisqFromScop,
        data: dataFromScop
      }
    ]
    res.json(data)
  }
}

const readTopKNum = async (file: string) => {
  try {
    const content = (await fs.readFile(file, 'utf-8')).trim()
    // console.log(content)
    const match = content.match(/newpdb_(\d+)/)
    const pdbNumber = match ? parseInt(match[1], 10) : null
    return pdbNumber
  } catch (error) {
    throw new Error('Could not determine top K PDB number')
  }
}

const parseFileContent = (fileContent: string) => {
  return fileContent
    .trim()
    .split('\n')
    .filter((line) => !line.startsWith('#')) // Filter out lines starting with '#'
    .map((line) => {
      const [q, exp_intensity, model_intensity, error] = line.trim().split(/\s+/)
      return {
        q: parseFloat(q),
        exp_intensity: parseFloat(exp_intensity),
        model_intensity: parseFloat(model_intensity),
        error: parseFloat(error)
      }
    })
}

const extractChiSquared = (fileContent: string) => {
  const lines = fileContent.split('\n')
  if (lines.length < 2) {
    return null
  }

  const chiSquaredLine = lines[1] // Get the second line
  const chiSquaredMatch = chiSquaredLine.match(/Chi\^2\s*=\s*([\d.]+)/)

  if (chiSquaredMatch && chiSquaredMatch[1]) {
    return parseFloat(chiSquaredMatch[1])
  } else {
    return null // Return null or appropriate default value if Chi^2 value is not found
  }
}

export { downloadPDB, getFoxsData }
