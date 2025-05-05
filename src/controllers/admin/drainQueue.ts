import { Request, Response } from 'express'
import { Queue } from 'bullmq'
import { bilbomdQueue } from '../../queues/bilbomd.js'
import { scoperQueue } from '../../queues/scoper.js'
import { multimdQueue } from '../../queues/multimd.js'
import { pdb2crdQueue } from '../../queues/pdb2crd.js'

const allQueues: Record<string, Queue> = {
  bilbomd: bilbomdQueue,
  scoper: scoperQueue,
  multimd: multimdQueue,
  pdb2crd: pdb2crdQueue
}

const drainQueue = async (req: Request, res: Response): Promise<void> => {
  const queueName = req.params.queueName

  const queue = allQueues[queueName]
  if (!queue) {
    res.status(404).json({ error: `Queue "${queueName}" not found` })
    return
  }

  try {
    await queue.drain()
    res.status(200).json({ message: `Queue "${queueName}" drained successfully` })
  } catch (error) {
    console.error(`Failed to drain queue "${queueName}":`, error)
    res.status(500).json({ error: 'Failed to drain queue' })
  }
}

export default drainQueue
