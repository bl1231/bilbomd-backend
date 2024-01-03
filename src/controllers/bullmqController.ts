// import { logger } from '../middleware/loggers'
import { getActiveCount, getWaitingCount, getWorkers } from '../queues/bilbomd'
import { Request, Response } from 'express'

const getQueueStatus = async (req: Request, res: Response) => {
  const bullmqActiveCount = await getActiveCount()
  const bullmqWaitCount = await getWaitingCount()
  const bullmqWorkerCount = (await getWorkers()).length
  const queueStatus = {
    name: 'bilbomd',
    active_count: bullmqActiveCount,
    waiting_count: bullmqWaitCount,
    worker_count: bullmqWorkerCount
  }
  // logger.info(queueStatus)
  res.json(queueStatus)
}

export { getQueueStatus }
