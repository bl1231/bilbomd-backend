import { logger } from '../middleware/loggers.js'
import { Queue } from 'bullmq'
import { config } from '../config/config.js'
import { BullMQData } from '../types/bilbomd.js'
import { redis } from './redisConn.js'

let multimdQueue: Queue

const getQueue = (): Queue => {
  if (!multimdQueue) {
    multimdQueue = new Queue('multimd', {
      connection: redis,
      defaultJobOptions: {
        attempts: config.bullmqAttempts
      }
    })
  }
  return multimdQueue
}

const queueJob = async (data: BullMQData) => {
  try {
    const queue = getQueue()
    logger.info(
      `${data.type} Job ${data.title} about to be added to ${multimdQueue.name} queue`
    )

    const bullJob = await queue.add(data.title, data)

    // logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)

    return bullJob.id
  } catch (error) {
    logger.error(`Error adding ${data.type} Job to ${multimdQueue.name} queue: ${error}`)
    throw error // Rethrow the error to handle it at a higher level if needed
  }
}

const queue = getQueue()

export { queueJob, queue as multimdQueue }
