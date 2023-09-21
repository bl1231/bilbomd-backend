const { logger } = require('../middleware/loggers')
const { getActiveCount, getWaitingCount, getWorkers } = require('../queues/jobQueue')

const getQueueStatus = async (req, res) => {
  const bullmqActiveCount = await getActiveCount()
  const bullmqWaitCount = await getWaitingCount()
  const bullmqWorkerCount = (await getWorkers()).length
  const queueStatus = {
    name: 'bilbomd',
    active_count: bullmqActiveCount,
    waiting_count: bullmqWaitCount,
    worker_count: bullmqWorkerCount
  }
  logger.info(queueStatus)
  res.json(queueStatus)
}

module.exports = { getQueueStatus }
