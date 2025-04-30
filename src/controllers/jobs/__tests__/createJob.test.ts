import type { Request, Response } from 'express'
import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual<typeof import('fs-extra')>('fs-extra')
  return {
    ...actual,
    remove: vi.fn().mockResolvedValue(undefined) // avoid error propagation
  }
})
vi.mock('../../../queues/bilbomd', () => ({
  queue: { add: vi.fn() }
}))
vi.mock('../jobs/utils/autoRg.js', () => ({
  spawnAutoRgCalculator: vi.fn(() =>
    Promise.resolve({
      rg: 30,
      rg_min: 25,
      rg_max: 35
    })
  )
}))
vi.mock('../../../queues/pdb2crd.js', async () => {
  const actual = await vi.importActual('../../../queues/pdb2crd.js')
  return {
    ...actual,
    waitForJobCompletion: vi.fn().mockResolvedValue(true)
  }
})
const mockMulterFields = vi.fn((req, res, cb) => cb(null))
import { User, IUser } from '@bl1231/bilbomd-mongodb-schema'
import type { HydratedDocument } from 'mongoose'
import { handleBilboMDAutoJob } from '../handleBilboMDAutoJob.js'

vi.mock('multer', () => ({
  default: Object.assign(
    () => ({
      fields: () => mockMulterFields
    }),
    {
      diskStorage: vi.fn(() => ({}))
    }
  )
}))

vi.mock('@bl1231/bilbomd-mongodb-schema', () => ({
  User: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn()
  }
}))

vi.mock('../handleBilboMDAutoJob', () => ({
  handleBilboMDAutoJob: vi.fn()
}))

describe('createNewJob', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // test('should return 400 if multer throws an error', async () => {
  //   mockMulterFields.mockImplementationOnce((req, res, cb) => cb(new Error('fail')))
  //   const { createNewJob } = await import('../createJob.js')

  //   const req = { body: {}, files: {} } as any
  //   const res = {
  //     status: vi.fn().mockReturnThis(),
  //     json: vi.fn()
  //   } as any

  //   await createNewJob(req, res)

  //   expect(res.status).toHaveBeenCalledWith(400)
  //   expect(res.json).toHaveBeenCalledWith(
  //     expect.objectContaining({ message: 'File upload error' })
  //   )
  // })

  test('should return 400 if bilbomd_mode is missing', async () => {
    const { createNewJob } = await import('../createJob.js')
    const req = { body: {} } as Partial<Request>
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as Partial<Response>

    await createNewJob(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'No job type provided' })
  })

  test('should return 401 if user not found by email', async () => {
    const { createNewJob } = await import('../createJob.js')
    const req = {
      body: { bilbomd_mode: 'auto' },
      email: 'notfound@example.com',
      apiUser: {} as IUser
    } as Partial<Request>
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as Partial<Response>

    ;(User.findOne as unknown as Mock).mockReturnValue({
      exec: vi.fn().mockResolvedValue(null)
    })

    await createNewJob(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'No user found with that email' })
  })

  // test('should dispatch to handleBilboMDAutoJob when mode is auto', async () => {
  //   mockMulterFields.mockImplementationOnce((req, res, cb) => {
  //     req.body = { bilbomd_mode: 'auto' }
  //     req.files = {
  //       dat_file: [{ originalname: 'somefile.dat' }],
  //       pdb_file: [{ originalname: 'file.pdb' }],
  //       pae_file: [{ originalname: 'pae.json' }]
  //     }
  //     cb(null)
  //   })

  //   const { createNewJob } = await import('../createJob.js')

  //   const req = {
  //     email: 'user@example.com',
  //     apiUser: true
  //   } as any

  //   const res = {
  //     status: vi.fn().mockReturnThis(),
  //     json: vi.fn()
  //   } as any

  //   ;(User.findOne as any).mockReturnValue({
  //     exec: vi.fn().mockResolvedValue({ _id: '123', email: 'user@example.com' })
  //   })
  //   ;(User.findByIdAndUpdate as any).mockResolvedValue({})
  //   ;(handleBilboMDAutoJob as any).mockResolvedValue(undefined)

  //   await createNewJob(req, res)

  //   expect(handleBilboMDAutoJob).toHaveBeenCalledWith(
  //     req,
  //     res,
  //     { _id: '123', email: 'user@example.com' },
  //     expect.any(String)
  //   )
  // })

  test('should return 500 if job handler throws', async () => {
    mockMulterFields.mockImplementationOnce((req, res, cb) => {
      req.body = { bilbomd_mode: 'auto' }
      req.files = {
        expdata: [{ originalname: 'somefile.dat' }],
        constinp: [{ originalname: 'const.inp' }]
      }
      cb(null)
    })

    const { createNewJob } = await import('../createJob.js')

    const req = {
      email: 'user@example.com',
      apiUser: {} as IUser,
      cookies: {},
      headers: {},
      query: {},
      body: {},
      files: {}
    } as Partial<Request>

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as Partial<Response>

    const fakeUser: Partial<HydratedDocument<IUser>> = {
      email: 'user@example.com'
    }

    ;(User.findOne as unknown as Mock).mockReturnValue({
      exec: vi.fn().mockResolvedValue(fakeUser)
    })
    ;(User.findByIdAndUpdate as unknown as Mock).mockResolvedValue({})
    ;(handleBilboMDAutoJob as unknown as Mock).mockRejectedValue(new Error('Boom'))

    await createNewJob(req as Request, res as Response)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Job submission failed',
        error: 'Boom'
      })
    )
  })
})
