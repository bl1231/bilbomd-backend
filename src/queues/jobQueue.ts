import IORedis, { RedisOptions } from 'ioredis'
import { Job as BullMQJob, Queue } from 'bullmq'
// import { IJob } from 'model/Job'
import { logger } from '../middleware/loggers'
import { BilboMDBullMQ, BullMQData, BilboMDSteps } from '../types/bilbomd'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD || '',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}
const redis = new IORedis(redisOptions)

const bilbomdQueue = new Queue('bilbomd', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3
  }
})

const queueJob = async (data: BullMQData) => {
  try {
    logger.info(`${data.type} Job "${data.title}" about to be added to queue`)

    const bullJob = await bilbomdQueue.add(data.title, data)

    logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)

    return bullJob.id
  } catch (error) {
    logger.error('Error adding job to queue:', error)
    throw error // Rethrow the error to handle it at a higher level if needed
  }
}

const getAllBullMQJobs = async (): Promise<BullMQJob[]> => {
  const allJobs = await bilbomdQueue.getJobs(
    ['completed', 'failed', 'waiting', 'active', 'delayed'],
    0,
    -1,
    true
  )
  return allJobs
}

const getWaitingJobs = async (): Promise<BullMQJob[]> => {
  const waitingJobs = await bilbomdQueue.getJobs(['waiting'], 0, -1, true)
  return waitingJobs
}

// const calculateJobPositions = async (): Promise<BilboMDJob[]> => {
//   const waitingJobs = await getWaitingJobs()

//   // Calculate and add position to each job
//   const myJobs: BilboMDJob[] = waitingJobs.map((job: BullMQJob, index: number) => ({
//     bullmq: job,
//     position: index + 1
//   }))

//   return myJobs
// }

// const getTextPositionOfJob = async (DBJob: IJob): Promise<string> => {
//   const waitingJobs = await calculateJobPositions()
//   const job = waitingJobs.find((job) => job.mongo.uuid === DBJob.uuid)
//   if (job) {
//     const position = job.position
//     const totalNumberWaiting = waitingJobs.length
//     return `${position} out of ${totalNumberWaiting}`
//   }
//   return ''
// }

const getBullMQJob = async (UUID: string): Promise<BilboMDBullMQ | undefined> => {
  const allJobs: BullMQJob[] = await getAllBullMQJobs()

  const bulljob = allJobs.find((job) => {
    return job.data.uuid === UUID
  })

  if (bulljob) {
    // calculate position number
    // calculate queuePosition text
    // append bilbomdStep
    const steps = await updateBilboMDSteps(bulljob)
    // append bilbomdLastStep
    const msg = await updateBilboMDInfo(bulljob)
    // Put it all together
    const bilboMDBullMQJob: BilboMDBullMQ = {
      position: 1,
      queuePosition: '1 of 1111',
      bilbomdStep: steps,
      bilbomdLastStep: msg,
      bullmq: bulljob
    }
    // logger.info(bilboMDBullMQJob)
    return bilboMDBullMQJob
  }
  return undefined
}

// const bilboMDRegSteps: BilboMDSteps = {
//   minimize: 'no',
//   heat: 'no',
//   md: 'no',
//   foxs: 'no',
//   multifoxs: 'no',
//   results: 'no',
//   email: 'no'
// }

const bilboSteps: BilboMDSteps = {
  pae: '',
  autorg: '',
  minimize: 'no',
  heat: 'no',
  md: 'no',
  foxs: 'no',
  multifoxs: 'no',
  results: 'no',
  email: 'no'
}

const updateBilboMDSteps = async (bullmq: BullMQJob): Promise<BilboMDSteps> => {
  let logData: { count: number; logs: string[] }

  if (bullmq.id) {
    logData = await bilbomdQueue.getJobLogs(bullmq.id, 0, -1, true)
  } else {
    logData = { count: 0, logs: [''] }
  }
  const logEntries = logData.logs

  const updatedSteps = await updateStepStatus(logEntries, bilboSteps)
  return updatedSteps
}

const updateBilboMDInfo = async (bullmq: BullMQJob): Promise<string> => {
  let logData: { count: number; logs: string[] }

  if (bullmq.id) {
    logData = await bilbomdQueue.getJobLogs(bullmq.id, 0, -1, true)
  } else {
    logData = { count: 0, logs: [''] }
  }
  const logEntries = logData.logs
  let lastLogMessage: string = ''

  if (logEntries.length > 0) {
    lastLogMessage = logEntries[logEntries.length - 1]
  }
  return lastLogMessage
}

const updateStepStatus = (jobLogs: string[], steps: BilboMDSteps): BilboMDSteps => {
  const updatedSteps = { ...steps } // Create a copy of the original steps object

  jobLogs.forEach((logLine) => {
    if (logLine.includes('start pae')) {
      updatedSteps.pae = 'start'
    } else if (logLine.includes('start autorg')) {
      updatedSteps.autorg = 'start'
    } else if (logLine.includes('start minimization')) {
      updatedSteps.minimize = 'start'
    } else if (logLine.includes('start heating')) {
      updatedSteps.heat = 'start'
    } else if (logLine.includes('start molecular dynamics')) {
      updatedSteps.md = 'start'
    } else if (logLine.includes('start FoXS')) {
      updatedSteps.foxs = 'start'
    } else if (logLine.includes('start MultiFoXS')) {
      updatedSteps.multifoxs = 'start'
    } else if (logLine.includes('start gather results')) {
      updatedSteps.results = 'start'
    } else if (logLine.includes('end pae')) {
      updatedSteps.pae = 'end'
    } else if (logLine.includes('end autorg')) {
      updatedSteps.autorg = 'end'
    } else if (logLine.includes('end minimization')) {
      updatedSteps.minimize = 'end'
    } else if (logLine.includes('end heating')) {
      updatedSteps.heat = 'end'
    } else if (logLine.includes('end molecular dynamics')) {
      updatedSteps.md = 'end'
    } else if (logLine.includes('end FoXS')) {
      updatedSteps.foxs = 'end'
    } else if (logLine.includes('end MultiFoXS')) {
      updatedSteps.multifoxs = 'end'
    } else if (logLine.includes('end gather results')) {
      updatedSteps.results = 'end'
    } else if (logLine.includes('email notification sent to')) {
      updatedSteps.email = 'end'
    } else if (logLine.includes('error pae')) {
      updatedSteps.pae = 'error'
    } else if (logLine.includes('error autorg')) {
      updatedSteps.autorg = 'error'
    } else if (logLine.includes('error minimization')) {
      updatedSteps.minimize = 'error'
    } else if (logLine.includes('error heating')) {
      updatedSteps.heat = 'error'
    } else if (logLine.includes('error molecular dynamics')) {
      updatedSteps.md = 'error'
    } else if (logLine.includes('error FoXS')) {
      updatedSteps.foxs = 'error'
    } else if (logLine.includes('error MultiFoXS')) {
      updatedSteps.multifoxs = 'error'
    } else if (logLine.includes('error gather results')) {
      updatedSteps.results = 'error'
    }
  })

  return updatedSteps
}

const getActiveCount = async () => {
  const num = await bilbomdQueue.getActiveCount()
  return num
}

const getWaitingCount = async () => {
  const num = await bilbomdQueue.getWaitingCount()
  return num
}

const getWorkers = async () => {
  const workers = await bilbomdQueue.getWorkers()
  return workers
}

export {
  queueJob,
  bilbomdQueue,
  getWaitingJobs,
  getBullMQJob,
  getActiveCount,
  getWaitingCount,
  getWorkers
}
