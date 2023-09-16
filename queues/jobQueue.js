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

// Function to get all jobs in the queue
const getAllBullMQJobs = async () => {
  // Use the getJobs method to fetch all jobs
  const jobs = await bilbomdQueue.getJobs(
    ['completed', 'failed', 'waiting', 'active', 'delayed'],
    0,
    -1,
    'asc'
  )

  // Iterate through the jobs and display information
  jobs.forEach(async (job) => {
    const status = await job.getState()
    logger.info('job %s status %s %s', job.id, status, job.name)
  })
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
  return -1 // Job not found in the "Waiting" queue
}

const getJobByUUID = async (UUID) => {
  const allJobs = await getAllBullMQJobs()
  const job = allJobs.find((job) => job.data.uuid === UUID)
  if (job) {
    // logger.info('job: %s', job)
    getJobLog(job.id)
    return job
  }
  logger.info('no job')
}

const getJobLog = async (JobId) => {
  const logData = await bilbomdQueue.getJobLogs(JobId, 0, -1, 'asc')
  const logEntries = logData.logs
  // logger.info('job log: %s', log)
  logEntries.forEach((entry, index) => {
    // console.log(`Log entry ${index + 1}: ${entry}`)
    logger.info(`job ${JobId} log entry ${index + 1}: ${entry}`)
  })
}

module.exports = {
  queueJob,
  bilbomdQueue,
  getAllBullMQJobs,
  getWaitingJobs,
  getPositionOfJob,
  getJobByUUID
}
