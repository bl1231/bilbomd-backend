import IORedis, { RedisOptions } from 'ioredis'
import { Job as BullMQJob, Queue } from 'bullmq'
import { logger } from '../middleware/loggers'
import { BilboMDBullMQ, BullMQData, BilboMDSteps } from '../types/bilbomd'

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

const bilbomdQueue = new Queue('bilbomd', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3
  }
})

const closeQueue = async () => {
  await bilbomdQueue.close()
  await redis.quit() // Disconnect from Redis
}

const queueJob = async (data: BullMQData) => {
  try {
    logger.info(
      `${data.type} Job ${data.title} about to be added to ${bilbomdQueue.name} queue`
    )

    const bullJob = await bilbomdQueue.add(data.title, data)

    // logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)

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

const getBullMQJob = async (UUID: string): Promise<BilboMDBullMQ | undefined> => {
  const allJobs: BullMQJob[] = await getAllBullMQJobs()

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

const bilboSteps: BilboMDSteps = {
  pae: '',
  autorg: '',
  minimize: 'no',
  heat: 'no',
  md: 'no',
  foxs: 'no',
  multifoxs: 'no',
  results: 'no',
  email: 'no',
  numEnsembles: 0
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

const updateStepStatus = async (
  jobLogs: string[],
  steps: BilboMDSteps
): Promise<BilboMDSteps> => {
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
  closeQueue,
  getWaitingJobs,
  getBullMQJob,
  getActiveCount,
  getWaitingCount,
  getWorkers
}
