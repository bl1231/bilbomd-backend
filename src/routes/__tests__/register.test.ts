import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import registerRoute from '../register'
import { User } from '@bl1231/bilbomd-mongodb-schema'

// Mock the entire @bl1231/bilbomd-mongodb-schema package
vi.mock('@bl1231/bilbomd-mongodb-schema', () => ({
  User: {
    findOne: vi.fn(() => ({
      collation: vi.fn().mockReturnThis(), // mock collation method and allow chaining
      lean: vi.fn().mockReturnThis(), // mock lean method and allow chaining
      exec: vi.fn().mockResolvedValueOnce(null) // mock exec method with resolved value
    })),
    create: vi.fn()
  }
}))

const app = express()
app.use(express.json())
app.use('/register', registerRoute)

describe('POST /register', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 if username or email is missing', async () => {
    const response = await request(app).post('/register').send({ username: 'testuser' })

    expect(response.statusCode).toBe(400)
    expect(response.body.message).toBe('Username and email are required.')
  })

  it('should return 409 if username is already taken', async () => {
    // Mock duplicate user check
    User.findOne.mockReturnValueOnce({
      collation: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce({ username: 'testuser' }) // Duplicate user
    })

    const response = await request(app)
      .post('/register')
      .send({ user: 'testuser', email: 'testemail@example.com' })

    expect(response.statusCode).toBe(409)
    expect(response.body.message).toBe('Duplicate username')
  })

  it('should return 409 if email is already taken', async () => {
    // Mock first call to findOne (checking username) - no duplicate username
    User.findOne.mockReturnValueOnce({
      collation: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce(null) // No duplicate username
    })

    // Mock second call to findOne (checking email) - duplicate email found
    User.findOne.mockReturnValueOnce({
      collation: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce({ email: 'testemail@example.com' }) // Duplicate email
    })

    const response = await request(app)
      .post('/register')
      .send({ user: 'testuser', email: 'testemail@example.com' })

    expect(response.statusCode).toBe(409)
    expect(response.body.message).toBe('Duplicate email')
  })

  it('should register a new user and return success', async () => {
    // Mock first call to findOne (checking username) - no duplicate username
    User.findOne.mockReturnValueOnce({
      collation: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce(null) // No duplicate username
    })

    // Mock second call to findOne (checking email) - no duplicate email
    User.findOne.mockReturnValueOnce({
      collation: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce(null) // No duplicate email
    })

    // Mock user creation
    User.create.mockResolvedValueOnce({ username: 'testuser' }) // User creation success

    const response = await request(app)
      .post('/register')
      .send({ user: 'testuser', email: 'testemail@example.com' })

    expect(response.statusCode).toBe(201)
    expect(response.body.success).toBe('New user testuser created!')
    expect(response.body.code).toBeDefined() // Ensure confirmation code is returned
  })

  it('should return 400 if there is a server error', async () => {
    // Mock server error
    User.create.mockRejectedValueOnce(new Error('Database failure'))

    const response = await request(app)
      .post('/register')
      .send({ user: 'testuser', email: 'testemail@example.com' })

    expect(response.statusCode).toBe(400)
    expect(response.body.message).toBe('Invalid user data received')
  })
})
