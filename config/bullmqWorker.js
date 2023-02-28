const { Worker } = require('bullmq')
const { processBilboMDJob } = require('../queues/processJobs')

const { REDIS_HOST, REDIS_PORT } = process.env

const workerOptions = {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    concurrency: 10
  }
}

const workerHandler = async (job) => {
  //console.log('Starting job', job.data.uuid)
  await processBilboMDJob(job.data)
  //console.log('Finished job', job.data.uuid)
  return
}

const bullmqWorker = async () => {
  try {
    await new Worker('bilbomd', workerHandler, workerOptions)
  } catch (err) {
    console.error(err)
  }
}

module.exports = bullmqWorker
