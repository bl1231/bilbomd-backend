import dotenv from 'dotenv'
dotenv.config({ path: './test/.env.test' })

import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { vi } from 'vitest'

export const mongoServer = await MongoMemoryServer.create()
const uri = mongoServer.getUri()

await mongoose.connect(uri)

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      close: vi.fn()
    })),
    Worker: vi.fn().mockImplementation(() => ({
      close: vi.fn()
    })),
    QueueScheduler: vi.fn().mockImplementation(() => ({
      close: vi.fn()
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      close: vi.fn()
    }))
  }
})
