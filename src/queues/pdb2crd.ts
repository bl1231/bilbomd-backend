import { Redis, RedisOptions } from 'ioredis'
import { Queue, QueueEvents } from 'bullmq'
import { logger } from '../middleware/loggers.js'
import { BullMQPdb2Crd } from '../types/bilbomd.js'
import { config } from '../config/config.js'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}

const redis = new Redis(redisOptions)

const pdb2crdQueue = new Queue('pdb2crd', {
  connection: redis,
  defaultJobOptions: {
    attempts: config.bullmqAttempts
  }
})

const closeQueue = async () => {
  await pdb2crdQueue.close()
  await redis.quit()
}

const pdb2crdQueueEvents = new QueueEvents('pdb2crd', {
  connection: redisOptions
})

const waitForJobCompletion = async (
  jobId: string,
  pdb2crdQueueEvents: QueueEvents
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const onCompleted = (event: { jobId: string; returnvalue?: unknown }) => {
      if (event.jobId === jobId) {
        pdb2crdQueueEvents.off('completed', onCompleted)
        pdb2crdQueueEvents.off('failed', onFailed)
        resolve()
      }
    }

    const onFailed = (event: { jobId: string; failedReason?: string }) => {
      if (event.jobId === jobId) {
        pdb2crdQueueEvents.off('completed', onCompleted)
        pdb2crdQueueEvents.off('failed', onFailed)
        reject(new Error(`Job ${jobId} failed with reason: ${event.failedReason}`))
      }
    }

    pdb2crdQueueEvents.on('completed', onCompleted)
    pdb2crdQueueEvents.on('failed', onFailed)
  })
}

const queueJob = async (data: BullMQPdb2Crd): Promise<string> => {
  try {
    logger.info(
      `${data.type} Job ${data.title} about to be added to ${pdb2crdQueue.name} queue`
    )
    const bullJob = await pdb2crdQueue.add(data.title, data)
    logger.info(`${data.type} Job added with Job ID: ${bullJob.id}`)
    if (!bullJob.id) {
      throw new Error('Failed to obtain a job ID from BullMQ')
    }
    return bullJob.id
  } catch (error) {
    logger.error(`Error adding ${data.type} Job to ${pdb2crdQueue.name} queue: ${error}`)
    throw error // This ensures that the function either returns a string or raises an exception
  }
}

export { queueJob, pdb2crdQueue, closeQueue, pdb2crdQueueEvents, waitForJobCompletion }
