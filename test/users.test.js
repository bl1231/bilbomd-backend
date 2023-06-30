const request = require('supertest')
const mongoose = require('mongoose')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')
const app = require('../app')
const User = require('../model/User')
let server
require('dotenv').config()

beforeAll(async () => {
  server = app.listen(5555)
  // Start out with empty users table
  await User.deleteMany()
})

afterAll(async () => {
  // await User.deleteOne({ username: 'testuser3' })
  await mongoose.disconnect()
  await queueMQ.close()
  await bilbomdQueue.close()
  await new Promise((resolve) => server.close(resolve))
})

//GET
describe('TEST /users API', () => {
  jest.setTimeout(5000)
  test('should return error if we are unauthorized', async () => {
    let res = await request(server).get('/users')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
})

//PATCH

//DELETE
