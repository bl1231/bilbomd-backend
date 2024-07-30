import IORedis, { RedisOptions } from 'ioredis'
import { Queue } from 'bullmq'
import { logger } from '../middleware/loggers'
import { BullMQData } from 'types/webhooks'
import { config } from '../config/config'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}
const redis = new IORedis(redisOptions)

const webhooksQueue = new Queue('webhooks', {
  connection: redis,
  defaultJobOptions: {
    attempts: config.bullmqAttempts
  }
})

const closeQueue = async () => {
  await webhooksQueue.close()
  await redis.quit()
}

const queueJob = async (data: BullMQData) => {
  try {
    logger.info(
      `Webhook Job ${data.title} about to be added to ${webhooksQueue.name} queue`
    )

    const bullJob = await webhooksQueue.add(data.title, data)

    return bullJob.id
  } catch (error) {
    logger.error('Error adding job to queue:', error)
    throw error
  }
}

export { webhooksQueue, closeQueue, queueJob }
