import { Queue } from 'bullmq'

const redisOptions = {
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  host: process.env.REDIS_HOST || 'localhost',
  tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : undefined
}

let deleteBilboMDJobsQueue: Queue | undefined

const getQueue = (): Queue => {
  if (!deleteBilboMDJobsQueue) {
    deleteBilboMDJobsQueue = new Queue('delete-bilbomd', {
      connection: redisOptions,
      defaultJobOptions: {
        attempts: 3
      }
    })
  }
  return deleteBilboMDJobsQueue
}

const queue = getQueue()

export { queue as deleteBilboMDJobsQueue }
