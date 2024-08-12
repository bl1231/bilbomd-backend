import IORedis, { RedisOptions } from 'ioredis'
import { Job as BullMQJob, Queue } from 'bullmq'
import { logger } from '../middleware/loggers.js'
import { BilboMDBullMQ, BullMQData, BilboMDScoperSteps } from '../types/bilbomd.js'
import { config } from '../config/config.js'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  // password: process.env.REDIS_PASSWORD || '',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}
const redis = new IORedis(redisOptions)

const scoperQueue = new Queue('bilbomd-scoper', {
  connection: redis,
  defaultJobOptions: {
    attempts: config.bullmqAttempts
  }
})

const closeQueue = async () => {
  await scoperQueue.close()
  redis.disconnect()
}

const queueScoperJob = async (data: BullMQData) => {
  try {
    logger.info(
      `${data.type} Job ${data.title} about to be added to ${scoperQueue.name} queue`
    )

    const bullJob = await scoperQueue.add(data.title, data)

    // logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)

    return bullJob.id
  } catch (error) {
    logger.error('Error adding job to queue:', error)
    throw error // Rethrow the error to handle it at a higher level if needed
  }
}

const getAllBullMQScoperJobs = async (): Promise<BullMQJob[]> => {
  const allJobs = await scoperQueue.getJobs(
    ['completed', 'failed', 'waiting', 'active', 'delayed'],
    0,
    -1,
    true
  )
  return allJobs
}

const getWaitingJobs = async (): Promise<BullMQJob[]> => {
  const waitingJobs = await scoperQueue.getJobs(['waiting'], 0, -1, true)
  // logger.info(`waiting jobs ${JSON.stringify(waitingJobs)}`)

  // waitingJobs.forEach((job) => {
  //   console.log('WAITING: ', job.name, job.data.uuid)
  // })
  return waitingJobs
}

const getWaitingPosition = async (bullmq: BullMQJob): Promise<number> => {
  const waitingJobs = await getWaitingJobs()
  // logger.info(`number of waiting jobs is: ${waitingJobs.length}`)
  // logger.info(`checking job UUID: ${bullmq.data.uuid}`)
  let position = 0

  for (let i = 0; i < waitingJobs.length; i++) {
    if (waitingJobs[i].data.uuid === bullmq.data.uuid) {
      position = i + 1
      // console.log('waiting: ', waitingJobs[i].name, position)
      break
    } else {
      // console.log('not waiting: ', waitingJobs[i].name)
    }
  }

  return position
}

const getWaitingPositionText = async (bullmq: BullMQJob): Promise<string> => {
  const position = await getWaitingPosition(bullmq)
  const totalNumberWaiting = await getWaitingCount()
  if (position === 0) {
    return ''
  }
  return `${position} out of ${totalNumberWaiting}`
}

const getBullMQScoperJob = async (UUID: string): Promise<BilboMDBullMQ | undefined> => {
  const allJobs: BullMQJob[] = await getAllBullMQScoperJobs()

  const bulljob = allJobs.find((job) => {
    return job.data.uuid === UUID
  })

  if (bulljob) {
    // calculate position as a number
    const position = (await getWaitingPosition(bulljob)) ?? '0'
    // calculate queuePosition as a text string
    const queuePosition = (await getWaitingPositionText(bulljob)) ?? '0'
    // append bilbomdStep
    const steps = (await updateBilboMDSteps(bulljob)) ?? '{}'
    // append bilbomdLastStep
    const msg = (await updateBilboMDInfo(bulljob)) ?? 'error'
    // Put it all together
    const bilboMDBullMQJob: BilboMDBullMQ = {
      position: position,
      queuePosition: queuePosition,
      bilbomdStep: steps,
      bilbomdLastStep: msg,
      bullmq: bulljob
    }
    // logger.info(bilboMDBullMQJob)
    return bilboMDBullMQJob
  }

  return undefined
}

const scoperSteps: BilboMDScoperSteps = {
  reduce: 'no',
  rnaview: 'no',
  kgs: 'no',
  kgsConformations: 0,
  kgsFiles: 0,
  foxs: 'no',
  foxsProgress: 0,
  foxsTopFile: '',
  foxsTopScore: 0,
  createdFeatures: false,
  IonNet: 'no',
  predictionThreshold: 0,
  multifoxs: 'no',
  multifoxsEnsembleSize: 0,
  multifoxsScore: 0,
  scoper: 'no',
  scoperPdb: '',
  results: 'no',
  email: 'no'
}

const updateBilboMDSteps = async (bullmq: BullMQJob): Promise<BilboMDScoperSteps> => {
  let logData: { count: number; logs: string[] }

  if (bullmq.id) {
    logData = await scoperQueue.getJobLogs(bullmq.id, 0, -1, true)
  } else {
    logData = { count: 0, logs: [''] }
  }
  const logEntries = logData.logs

  const updatedSteps = await updateStepStatus(logEntries, scoperSteps)
  return updatedSteps
}

const updateBilboMDInfo = async (bullmq: BullMQJob): Promise<string> => {
  let logData: { count: number; logs: string[] }

  if (bullmq.id) {
    logData = await scoperQueue.getJobLogs(bullmq.id, 0, -1, true)
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

const updateStepStatus = async (
  jobLogs: string[],
  steps: BilboMDScoperSteps
): Promise<BilboMDScoperSteps> => {
  const updatedSteps = { ...steps } // Create a copy of the original steps object

  jobLogs.forEach((logLine) => {
    if (logLine.includes('start scoper')) {
      updatedSteps.scoper = 'start'
    } else if (logLine.includes('start gather results')) {
      updatedSteps.results = 'start'
    } else if (logLine.includes('end scoper')) {
      updatedSteps.scoper = 'end'
    } else if (logLine.includes('end gather results')) {
      updatedSteps.results = 'end'
    } else if (logLine.includes('email notification sent to')) {
      updatedSteps.email = 'end'
    } else if (logLine.includes('error scoper')) {
      updatedSteps.scoper = 'error'
    } else if (logLine.includes('error gather results')) {
      updatedSteps.results = 'error'
    }
  })

  return updatedSteps
}

const getActiveCount = async () => {
  const num = await scoperQueue.getActiveCount()
  return num
}

const getWaitingCount = async () => {
  const num = await scoperQueue.getWaitingCount()
  return num
}

const getWorkers = async () => {
  const workers = await scoperQueue.getWorkers()
  return workers
}

export {
  queueScoperJob,
  scoperQueue,
  closeQueue,
  getWaitingJobs,
  getBullMQScoperJob,
  getActiveCount,
  getWaitingCount,
  getWorkers
}
