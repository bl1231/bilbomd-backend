const request = require('supertest')
const mongoose = require('mongoose')
const app = require('../app')
const User = require('../model/User')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')
let server
require('dotenv').config()

beforeAll(async () => {
  server = app.listen(5555, () => {
    // console.log('server started')
  })
  await User.create({
    username: 'testuser1',
    email: 'testuser1@example.com',
    roles: ['User'],
    confirmationCode: { code: '12345', expiresAt: new Date(Date.now() + 3600000) }
  })
})

afterAll(async () => {
  await User.deleteOne({ username: 'testuser1' })
  await User.deleteOne({ username: 'testuser2' })
  await mongoose.disconnect()
  await queueMQ.close()
  await bilbomdQueue.close()
  await new Promise((resolve) => server.close(resolve))
})

describe('TEST /register API', () => {
  jest.setTimeout(5000)
  test('should return error if no user or email provided', async () => {
    let res = await request(server).post('/register').send({ user: '', email: '' })
    expect(res.statusCode).toBe(400)
    // console.log(res)
    expect(res.body.message).toBe('Username and email are required.')
  })
  test('Should return error when duplicate username provided', async () => {
    let res = await request(server)
      .post('/register')
      .send({ user: 'testuser1', email: 'testuser2@example.com' })
    expect(res.statusCode).toBe(409)
    expect(res.body.message).toBe('Duplicate username')
  })
  test('Should return error when duplicate email provided', async () => {
    let res = await request(server)
      .post('/register')
      .send({ user: 'testuser2', email: 'testuser1@example.com' })
    expect(res.statusCode).toBe(409)
    expect(res.body.message).toBe('Duplicate email')
  })
  test('Should create new user', async () => {
    let res = await request(server)
      .post('/register')
      .send({ user: 'testuser2', email: 'testuser2@example.com' })
    expect(res.statusCode).toBe(201)
    expect(res.body.success).toBe(`New user testuser2 created!`)
  })
  test('Should give error if new user is malformed', async () => {
    let res = await request(server)
      .post('/register')
      .send({ userr: 'testuser2', emailack: 'testuser2@example.com' })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Username and email are required.')
  })
})
