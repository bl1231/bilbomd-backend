import dotenv from 'dotenv'
dotenv.config({ path: './test/.env.test' })

import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { vi } from 'vitest'
import fs from 'fs-extra'

// Setup MongoDB Memory Server
export const mongoServer = await MongoMemoryServer.create()
const uri = mongoServer.getUri()

await mongoose.connect(uri)

// Mock bullmq queues
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

// 🛠 Clean /tmp/bilbomd-data
const testDataDir = process.env.DATA_VOL ?? '/tmp/bilbomd-data'

await fs.ensureDir(testDataDir)
await fs.emptyDir(testDataDir)
console.log(`[setup] Emptied test data directory: ${testDataDir}`)
