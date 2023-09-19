const { Queue } = require('bullmq')
const { logger } = require('../middleware/loggers')

const bilbomdQueue = new Queue('bilbomd', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  defaultJobOptions: {
    attempts: 3
  }
})

const queueJob = async (job) => {
  try {
    logger.info('Adding job to queue: %s', job.title)

    // Add the job to the queue and await the BullMQ job object
    const bullJob = await bilbomdQueue.add(job.title, job)

    logger.info('Job added to: %s queue with Job ID: %s', bullJob.queue.name, bullJob.id)
    return bullJob.id // Optionally return the job ID for further reference
  } catch (error) {
    // Handle any errors that occur during job addition
    logger.error('Error adding job to queue:', error)
    throw error // Rethrow the error to handle it at a higher level if needed
  }
}

const getAllBullMQJobs = async () => {
  const jobs = await bilbomdQueue.getJobs(
    ['completed', 'failed', 'waiting', 'active', 'delayed'],
    0,
    -1,
    'asc'
  )

  // Iterate through the jobs and display information
  // jobs.forEach(async (job) => {
  //   const status = await job.getState()
  //   logger.info('job %s status %s %s', job.id, status, job.name)
  // })
  return jobs
}

const getWaitingJobs = async () => {
  const jobs = await bilbomdQueue.getJobs(['waiting'], 0, -1, 'asc')
  return jobs
}

const calculateJobPositions = async () => {
  const waitingJobs = await getWaitingJobs()

  // Calculate and add position to each job
  waitingJobs.forEach((job, index) => {
    job.positionInQueue = index + 1
  })

  return waitingJobs
}

const getPositionOfJob = async (jobUUID) => {
  const waitingJobs = await calculateJobPositions()
  const job = waitingJobs.find((job) => job.data.uuid === jobUUID)
  if (job) {
    const position = job.positionInQueue
    const totalNumberWaiting = waitingJobs.length
    return `${position} out of ${totalNumberWaiting}`
  }
  return ''
}

const getJobByUUID = async (UUID) => {
  const allJobs = await getAllBullMQJobs()
  const job = allJobs.find((job) => job.data.uuid === UUID)
  if (job) {
    return parseJobLogs(job)
  }
  logger.info('no job')
}

const parseJobLogs = async (job) => {
  const logData = await bilbomdQueue.getJobLogs(job.id, 0, -1, 'asc')
  const logEntries = logData.logs
  const bilboMDSteps = {
    minimize: 'no',
    heat: 'no',
    md: 'no',
    foxs: 'no',
    multifoxs: 'no',
    results: 'no',
    email: 'no'
  }
  const stepStatus = updateStepStatus(logEntries, bilboMDSteps)
  const lastLogMessage = logEntries.at(-1)
  job.bilbomdStep = stepStatus
  // logger.info('last step %s', lastLogMessage)
  job.bilbomdLastStep = lastLogMessage
  return job
}

const updateStepStatus = (jobLogs, steps) => {
  const updatedSteps = { ...steps } // Create a copy of the original steps object

  jobLogs.forEach((logLine) => {
    if (logLine.includes('start minimization')) {
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

module.exports = {
  queueJob,
  bilbomdQueue,
  getAllBullMQJobs,
  getWaitingJobs,
  getPositionOfJob,
  getJobByUUID,
  getActiveCount,
  getWaitingCount
}
