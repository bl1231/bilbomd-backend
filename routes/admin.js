const express = require('express')
const router = express.Router()
const { createBullBoard } = require('@bull-board/api')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const { Queue: QueueMQ } = require('bullmq')

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

createBullBoard({
  queues: [new BullMQAdapter(queueMQ)],
  serverAdapter: serverAdapter
})

router.use('/queues', serverAdapter.getRouter())

module.exports = { router, queueMQ }
