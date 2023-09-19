const { logger } = require('../middleware/loggers')
const { getActiveCount, getWaitingCount } = require('../queues/jobQueue')

const getQueueStatus = async (req, res) => {
  const bullmqActiveCount = await getActiveCount()
  const bullmqWaitCount = await getWaitingCount()
  const queueStatus = {
    name: 'bilbomd',
    active_count: bullmqActiveCount,
    waiting_count: bullmqWaitCount
  }
  logger.info(queueStatus)
  res.json(queueStatus)
}

module.exports = { getQueueStatus }
