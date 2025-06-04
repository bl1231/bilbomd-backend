import { Request, Response } from 'express'
import { allQueues } from './allQueues.js'

const getJobsByQueue = async (req: Request, res: Response): Promise<void> => {
  const { queueName } = req.params

  const queue = allQueues[queueName]
  if (!queue) {
    res.status(404).json({ message: `Queue "${queueName}" not found` })
    return
  }

  try {
    const jobs = await queue.getJobs(
      ['waiting', 'active', 'completed', 'failed', 'delayed'],
      0,
      49
    )

    const jobSummaries = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState()
        return {
          id: job.id,
          name: job.name,
          data: job.data,
          status: job.finishedOn ? 'completed' : job.failedReason ? 'failed' : state,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade
        }
      })
    )

    res.status(200).json({ queueName, jobs: jobSummaries })
  } catch (error) {
    console.error(`Failed to fetch jobs for queue "${queueName}"`, error)
    res.status(500).json({
      message: `Failed to fetch jobs for queue "${queueName}"`,
      error: (error as Error).message
    })
  }
}

export { getJobsByQueue }
