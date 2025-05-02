import { Redis, RedisOptions } from 'ioredis'
import { logger } from '../middleware/loggers.js'
import { Queue } from 'bullmq'
import { config } from '../config/config.js'
import { BullMQData } from '../types/bilbomd.js'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}

const redis = new Redis(redisOptions)

const multimdQueue = new Queue('multimd', {
  connection: redis,
  defaultJobOptions: {
    attempts: config.bullmqAttempts
  }
})

const queueJob = async (data: BullMQData) => {
  try {
    logger.info(
      `${data.type} Job ${data.title} about to be added to ${multimdQueue.name} queue`
    )

    const bullJob = await multimdQueue.add(data.title, data)

    // logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)

    return bullJob.id
  } catch (error) {
    logger.error(`Error adding ${data.type} Job to ${multimdQueue.name} queue: ${error}`)
    throw error // Rethrow the error to handle it at a higher level if needed
  }
}

export { queueJob, multimdQueue }
