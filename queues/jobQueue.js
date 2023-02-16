const { Queue } = require('bullmq')

const bilbomdQueue = new Queue('bilbomd', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
})

const queueJob = async (job) => {
  await bilbomdQueue.add(job.title, job)
  return
}

module.exports = { queueJob }
