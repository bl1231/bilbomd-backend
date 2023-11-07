import mongoose from 'mongoose'
import { connectDB } from '../config/dbConn'
import path from 'path'
import fs from 'fs-extra'
// import IORedis, { RedisOptions } from 'ioredis'
// import { Queue } from 'bullmq'
import { Job } from '../model/Job'
import { logger } from './loggers'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

// const redisOptions: RedisOptions = {
//   port:
//     process.env.REDIS_PORT && !isNaN(parseInt(process.env.REDIS_PORT, 10))
//       ? parseInt(process.env.REDIS_PORT, 10)
//       : 6379,
//   host: process.env.REDIS_HOST || 'localhost',
//   password: process.env.REDIS_PASSWORD || '',
//   tls: process.env.REDIS_TLS ? JSON.parse(process.env.REDIS_TLS) : false
// }
// const redis = new IORedis(redisOptions)

// const bilbomdQueue = new Queue('bilbomd', {
//   connection: redis,
//   defaultJobOptions: {
//     attempts: 3
//   }
// })

export const deleteOldJobs = async () => {
  try {
    // Connect to MongoDB (if not already connected)
    if (mongoose.connection.readyState !== 1) {
      connectDB()
    }

    // Delete old jobs from MongoDB
    const maxAge = 30 * 24 * 60 * 60
    const thresholdDate = new Date(Date.now() - maxAge * 1000)

    const oldJobs = await Job.find({ createdAt: { $lt: thresholdDate } })
    const numOldJobs = oldJobs.length

    if (numOldJobs > 0) {
      logger.warn(`Found ${numOldJobs} jobs older than 1 month.`)
    }

    for (const job of oldJobs) {
      logger.warn(
        `Preparing to delete: ${job.title} user: ${job.user.username} completed: ${job.time_completed}`
      )
      const jobDir = path.join(uploadFolder, job.uuid)

      try {
        const exists = await fs.pathExists(jobDir)
        if (!exists) {
          logger.warn(`Directory ${jobDir} not found on disk`)
        } else {
          await fs.remove(jobDir)
        }
      } catch (error) {
        logger.error('Error deleting directory %s', error)
      }
    }

    const deleteResult = await Job.deleteMany({ createdAt: { $lt: thresholdDate } })
    const deletedJobsCount = deleteResult.deletedCount
    logger.warn(`Deleted ${deletedJobsCount} jobs from MongoDB`)

    // Delete old jobs from BullMQ queue
    // const limit = 100
    // logger.warn(
    //   `Cleaning up to ${limit} jobs older than ${maxAge} sec. from bilbomd queue.`
    // )
    // const deletedJobs = await bilbomdQueue.clean(maxAge, limit)

    // if (deletedJobs.length > 0) {
    //   logger.warn(`Cleaned ${deletedJobs.length} jobs from BullMQ`)
    // } else {
    //   logger.warn('No jobs were cleaned from BullMQ')
    // }
  } catch (error) {
    console.error('Error deleting old jobs:', error)
  }
}
