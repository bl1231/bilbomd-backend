const express = require('express')
const router = express.Router()
const { Queue: QueueMQ, Worker, QueueScheduler } = require('bullmq')

const { ExpressAdapter, createBullBoard, BullMQAdapter } = require('@bull-board/express')

const basePath = '/admin/queues'

const redisOptions = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: '',
  tls: false
}

const queueMQ = new QueueMQ('bilbomd', { connection: redisOptions })

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath(basePath)

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [new BullMQAdapter(queueMQ)],
  serverAdapter: serverAdapter
})

router.use('/queues', serverAdapter.getRouter())

module.exports = router
