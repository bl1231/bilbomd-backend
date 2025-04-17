import { Request, Response } from 'express'
import { createNewJob } from '../jobs/index.js'

export const submitApiJob = async (req: Request, res: Response) => {
  try {
    const { bilbomd_mode } = req.body
    const user = req.apiUser

    if (!user) {
      res.status(403).json({ message: 'Missing user context' })
      return
    }
    if (!bilbomd_mode) {
      res.status(400).json({ message: 'Missing job type' })
    }

    const jobType = bilbomd_mode.toLowerCase()
    console.log(`External job submission received: ${jobType} from ${user.email}`)

    if (jobType === 'pdb' || jobType === 'crd_psf' || jobType === 'auto') {
      await createNewJob(req, res)
    } else {
      console.warn(`Invalid job type from API: ${jobType}`)
      res.status(400).json({ message: `Invalid API job type: ${jobType}` })
    }
  } catch (err) {
    console.error('submitApiJob error:', err)
    res.status(500).json({ message: 'Failed to submit API job' })
  }
}
