import express from 'express'
const router = express.Router()
import IORedis, { RedisOptions } from 'ioredis'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { Queue as QueueMQ } from 'bullmq'

const basePath = '/v1/admin/queues'

const redisOptions: RedisOptions = {
  port:
    process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  // password: process.env.REDIS_PASSWORD || '',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
}

const redis = new IORedis(redisOptions)

const queueMQ = new QueueMQ('bilbomd', { connection: redis })

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath(basePath)

createBullBoard({
  queues: [new BullMQAdapter(queueMQ)],
  serverAdapter: serverAdapter
})

router.use('/queues', serverAdapter.getRouter())

export { router, queueMQ }
