const request = require('supertest')
const mongoose = require('mongoose')
const app = require('../app')
const User = require('../model/User')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')

require('dotenv').config()

describe('POST /magicklink', () => {
  let server
  let confirmationCode
  beforeAll(async () => {
    server = app.listen(5555, () => {
      // console.log('test server started')
    })
    let res = await request(server)
      .post('/register')
      .send({ user: 'testuser1', email: 'testuser1@example.com' })
    confirmationCode = res.body.code
    // console.log('cc1: ', confirmationCode)
  })

  afterAll(async () => {
    await User.deleteOne({ username: 'testuser1' })
    await mongoose.disconnect()
    await queueMQ.close()
    await bilbomdQueue.close()
    await new Promise((resolve) => server.close(resolve))
  })
  jest.setTimeout(5000)
  test('should return error if no user or email provided', async () => {
    let res = await request(server).post('/magicklink').send({ email: '' })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('email is required')
  })
  test('Should return error when email not in DB', async () => {
    let res = await request(server)
      .post('/magicklink')
      .send({ email: 'testuser2@example.com' })
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('no account with that email')
  })
  test('Should return error if user is Pending', async () => {
    let res = await request(server)
      .post('/magicklink')
      .send({ email: 'testuser1@example.com' })
    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Pending')
  })
  test('Should verify confirmation code and request OTP', async () => {
    // console.log('cc2: ', confirmationCode)
    let res = await request(server).post('/verify').send({ code: confirmationCode })
    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe('Verified')
    let res2 = await request(server)
      .post('/magicklink')
      .send({ email: 'testuser1@example.com' })
    expect(res2.statusCode).toBe(201)
    expect(res2.body.success).toBe('OTP created for testuser1@example.com')
  })
})
