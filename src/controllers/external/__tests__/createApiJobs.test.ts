import type { Request, Response } from 'express'
import { describe, test, expect, vi } from 'vitest'
import { createApiJob } from '../createApiJob.js'
import { createNewJob } from '../../jobs/index.js'
import { IUser } from '@bl1231/bilbomd-mongodb-schema'

vi.mock('../../jobs/index.js', () => ({
  createNewJob: vi.fn()
}))

describe('createApiJob', () => {
  test('should return 403 if apiUser is missing', async () => {
    const req = {} as Partial<{
      apiUser: { email: string }
      headers: Record<string, string>
    }>
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as { status: (code: number) => { json: (body: any) => void } }

    await createApiJob(req, res)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ message: 'Missing API user context' })
  })

  test('should handle error if createNewJob throws', async () => {
    ;(createNewJob as any).mockImplementation(() => {
      throw new Error('mock error')
    })
    const req = {
      apiUser: { email: 'test@example.com' },
      headers: {}
    } as Partial<{ apiUser: { email: string }; headers: Record<string, string> }>
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    await createApiJob(req, res)
    console.log('status calls:', status.mock.calls)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ message: 'Failed to submit API job' })
  })
})
