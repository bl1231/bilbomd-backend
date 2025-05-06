import { Request, Response } from 'express'
import { bilbomdQueue } from '../../queues/bilbomd.js'
import { scoperQueue } from '../../queues/scoper.js'
import { multimdQueue } from '../../queues/multimd.js'
import { pdb2crdQueue } from '../../queues/pdb2crd.js'
import { Queue } from 'bullmq'

const allQueues: Record<string, Queue> = {
  bilbomd: bilbomdQueue,
  scoper: scoperQueue,
  multimd: multimdQueue,
  pdb2crd: pdb2crdQueue
}

const deleteQueueJob = async (req: Request, res: Response): Promise<void> => {
  const { queueName, jobId } = req.params

  const queue = allQueues[queueName]
  if (!queue) {
    res.status(404).json({ error: `Queue "${queueName}" not found` })
    return
  }

  try {
    const job = await queue.getJob(jobId)
    if (!job) {
      res
        .status(404)
        .json({ error: `Job ID "${jobId}" not found in queue "${queueName}"` })
      return
    }

    await job.remove()
    res
      .status(200)
      .json({ message: `Job ID "${jobId}" removed from queue "${queueName}"` })
  } catch (error) {
    console.error(`Failed to remove job "${jobId}" from queue "${queueName}":`, error)
    res.status(500).json({ error: 'Failed to remove job from queue' })
  }
}

export default deleteQueueJob
