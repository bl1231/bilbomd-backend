const { Queue } = require('bullmq')

const bilbomdQueue = new Queue('bilbomd', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  defaultJobOptions: {
    attempts: 3,
    priority: 1
  }
})

const queueJob = async (job) => {
  await bilbomdQueue.add(job.title, job)
}

module.exports = { queueJob }
