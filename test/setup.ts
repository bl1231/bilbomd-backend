import dotenv from 'dotenv'
import { on } from 'events'
dotenv.config({ path: './test/.env.test' })

import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { off } from 'process'
import { vi } from 'vitest'

export const mongoServer = await MongoMemoryServer.create()
const uri = mongoServer.getUri()

await mongoose.connect(uri)

const mockQueue = {
  name: 'bilbomd-mock',
  add: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    name: 'mock-job',
    data: { foo: 'bar' }
  }),
  close: vi.fn()
}

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn(() => mockQueue),
    Worker: vi.fn(() => ({ close: vi.fn() })),
    QueueScheduler: vi.fn(() => ({ close: vi.fn() })),
    QueueEvents: vi.fn(() => ({ close: vi.fn(), on: vi.fn(), off: vi.fn() }))
  }
})
