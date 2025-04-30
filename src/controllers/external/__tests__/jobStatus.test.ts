import { describe, test, expect, vi } from 'vitest'
import { getApiJobStatus } from '../jobStatus.js'
import { Job } from '@bl1231/bilbomd-mongodb-schema'
import mongoose from 'mongoose'

vi.mock('@bl1231/bilbomd-mongodb-schema', () => ({
  Job: {
    findById: vi.fn()
  }
}))

describe('getApiJobStatus', () => {
  test('should return 400 if job ID is not a valid ObjectId', async () => {
    const req = { params: { id: 'invalid-id' }, apiUser: { _id: 'user123' } } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ message: 'Invalid job ID format' })
  })

  test('should return 403 if apiUser is missing', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ message: 'Unauthorized access' })
  })

  test('should return 404 if job is not found', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      apiUser: { _id: 'user123' }
    } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    ;(Job.findById as any).mockResolvedValue(null)

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ message: 'No job found with ID' })
  })

  test('should return 403 if job belongs to a different user', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      apiUser: { _id: 'user123' }
    } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    const fakeJob = { user: 'someone_else' }
    ;(Job.findById as any).mockResolvedValue(fakeJob)

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({
      message: 'Forbidden: job does not belong to user'
    })
  })

  test('should return 200 with job status details if user owns the job', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      apiUser: { _id: 'user123' }
    } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    const fakeJob = {
      user: 'user123',
      status: 'Complete',
      progress: 100,
      title: 'Job Title',
      __t: 'auto',
      uuid: 'abc-uuid',
      time_submitted: new Date(),
      time_completed: new Date()
    }

    ;(Job.findById as any).mockResolvedValue(fakeJob)

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      status: 'Complete',
      progress: 100,
      title: 'Job Title',
      mode: 'auto',
      uuid: 'abc-uuid',
      submittedAt: fakeJob.time_submitted,
      completedAt: fakeJob.time_completed
    })
  })

  test('should return 200 with null progress if progress field is missing', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      apiUser: { _id: 'user123' }
    } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    const fakeJob = {
      user: 'user123',
      status: 'Running',
      title: 'Job without progress',
      __t: 'auto',
      uuid: 'no-progress-uuid',
      time_submitted: new Date(),
      time_completed: null
    }

    ;(Job.findById as any).mockResolvedValue(fakeJob)

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      status: 'Running',
      progress: null,
      title: 'Job without progress',
      mode: 'auto',
      uuid: 'no-progress-uuid',
      submittedAt: fakeJob.time_submitted,
      completedAt: null
    })
  })

  test('should return 500 if an unexpected error occurs', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      apiUser: { _id: 'user123' }
    } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    ;(Job.findById as any).mockRejectedValue(new Error('Unexpected'))

    await getApiJobStatus(req, res)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      message: 'Failed to retrieve job status'
    })
  })
})
