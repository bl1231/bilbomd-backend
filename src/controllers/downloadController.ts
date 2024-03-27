import { logger } from '../middleware/loggers'
import fs from 'fs-extra'
import path from 'path'
import { Job } from '../model/Job'
import { IJob, IBilboMDScoperJob } from '../model/Job'
import { FoxsData, FoxsDataPoint } from 'types/foxs'
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
    return res.status(404).json({ message: `No job matches ID ${jobId}.` })
  }
  try {
    if (job.__t === 'BilboMdScoper') {
      const scoperJob = job as IBilboMDScoperJob
      await getFoxsScoperData(scoperJob, res)
    } else {
      await getFoxsBilboData(job, res)
    }
  } catch (error) {
    console.error(`Error getting FoXS data: ${error}`)
    res.status(500).json({ message: 'Error processing FoXS data.' })
  }
}

const getFoxsScoperData = async (job: IBilboMDScoperJob, res: Response) => {
  const datFileBase = job.data_file.split('.')[0]
  const pdbFileBase = job.pdb_file.split('.')[0]
  const topKFile = path.join(uploadFolder, job.uuid, 'top_k_dirname.txt')
  const pdbNumber = await readTopKNum(topKFile)

  const foxsAnalysisDir = path.join(uploadFolder, job.uuid, 'foxs_analysis')
  if (!fs.existsSync(foxsAnalysisDir)) {
    return res.status(404).json({ message: 'FoXS analysis data not found.' })
  }
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
  const foxsLog = path.join(uploadFolder, job.uuid, 'foxs_analysis', 'foxs.log')

  const originalDatContent = fs.readFileSync(originalDat, 'utf8')
  const scoperDatContent = fs.readFileSync(scoperDat, 'utf8')
  const foxsLogContent = fs.readFileSync(foxsLog, 'utf8')

  const dataFromOrig = parseFileContent(originalDatContent)
  const dataFromScop = parseFileContent(scoperDatContent)

  const chisqFromOrig = extractChiSquared(originalDatContent)
  const chisqFromScop = extractChiSquared(scoperDatContent)

  const { c1FromOrig, c1FromScop } = extractC1Values(foxsLogContent)
  const { c2FromOrig, c2FromScop } = extractC2Values(foxsLogContent)

  const data = [
    {
      filename: job.pdb_file,
      chisq: chisqFromOrig,
      c1: c1FromOrig,
      c2: c2FromOrig,
      data: dataFromOrig
    },
    {
      filename: `scoper_combined_newpdb_${pdbNumber}.pdb`,
      chisq: chisqFromScop,
      c1: c1FromScop,
      c2: c2FromScop,
      data: dataFromScop
    }
  ]
  res.json(data)
}

const getFoxsBilboData = async (job: IJob, res: Response) => {
  try {
    let data: FoxsData[] = []

    const jobDir = path.join(uploadFolder, job.uuid)
    const resultsDir = path.join(uploadFolder, job.uuid, 'results')

    if (!fs.existsSync(resultsDir)) {
      return res.status(404).json({ message: 'results directory unavailable.' })
    }

    const datFileBase = job.data_file.split('.')[0]
    const originalDat = path.join(jobDir, `minimization_output_${datFileBase}.dat`)

    data.push(await createDataObject(originalDat))

    const files = await fs.readdir(resultsDir)
    const filePattern = /^multi_state_model_\d+_1_1\.dat$/

    for (const file of files) {
      if (filePattern.test(file)) {
        logger.info(`getFoXSData ${file}`)
        const filename = path.join(resultsDir, file)
        data.push(await createDataObject(filename))
      }
    }

    res.json(data)
  } catch (error) {
    logger.error(`error getting FoXS analysis data`)
    return res
      .status(500)
      .json({ message: 'Internal server error while processing FoXS analysis data.' })
  }
}

const createDataObject = async (file: string): Promise<FoxsData> => {
  // const foxsLog = path.join(uploadFolder, job.uuid, 'foxs_analysis', 'foxs.log')
  const fileContent = await fs.readFile(file, 'utf8')
  const filename = path.basename(file)
  const data: FoxsDataPoint[] = parseFileContent(fileContent)
  const chisq: number = extractChiSquared(fileContent)
  const c1 = parseFloat('1.234') // replace with actual function
  const c2 = parseFloat('4.321') // replace with actual function
  const foxsData: FoxsData = {
    filename: filename,
    chisq: chisq,
    c1: c1,
    c2: c2,
    data: data
  }
  return foxsData
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

const parseFileContent = (fileContent: string): FoxsDataPoint[] => {
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

const extractChiSquared = (fileContent: string): number => {
  const lines = fileContent.split('\n')
  if (lines.length < 2) {
    return 0.0
  }

  const chiSquaredLine = lines[1] // Get the second line
  const chiSquaredMatch = chiSquaredLine.match(/Chi\^2\s*=\s*([\d.]+)/)

  if (chiSquaredMatch && chiSquaredMatch[1]) {
    return parseFloat(chiSquaredMatch[1])
  } else {
    return 0.0 // Return null or appropriate default value if Chi^2 value is not found
  }
}

const extractC1Values = (fileContent: string) => {
  const lines = fileContent.split('\n')
  let c1FromOrig = null
  let c1FromScop = null

  for (const line of lines) {
    // Match lines containing 'c1 ='
    const c1Match = line.match(/c1\s*=\s*([-\d.]+)/)

    if (c1Match && c1Match[1]) {
      if (c1FromOrig === null) {
        c1FromOrig = parseFloat(c1Match[1])
      }

      // Check if the line starts with 'scoper_combined_'
      if (line.startsWith('scoper_combined_')) {
        c1FromScop = parseFloat(c1Match[1])
        break
      }
    }
  }
  // logger.info(`FoXS origC1: ${c1FromOrig} scopC1: ${c1FromScop}`)
  return { c1FromOrig, c1FromScop }
}

const extractC2Values = (fileContent: string) => {
  const lines = fileContent.split('\n')
  let c2FromOrig = null
  let c2FromScop = null

  for (const line of lines) {
    // Match lines containing 'c2 ='
    const c2Match = line.match(/c2\s*=\s*([-\d.]+)/)

    if (c2Match && c2Match[1]) {
      if (c2FromOrig === null) {
        c2FromOrig = parseFloat(c2Match[1])
      }

      // Check if the line starts with 'scoper_combined_'
      if (line.startsWith('scoper_combined_')) {
        c2FromScop = parseFloat(c2Match[1])
        break
      }
    }
  }
  // logger.info(`FoXS origC2: ${c2FromOrig} scopC2: ${c2FromScop}`)
  return { c2FromOrig, c2FromScop }
}

export { downloadPDB, getFoxsData }
