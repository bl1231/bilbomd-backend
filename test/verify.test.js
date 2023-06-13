const request = require('supertest')
const mongoose = require('mongoose')
const app = require('../app')
const User = require('../model/User')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')
let server
require('dotenv').config()

beforeAll(async () => {
  server = app.listen(5555)
  await User.create({
    username: 'testuser3',
    email: 'testuser3@example.com',
    roles: ['User'],
    confirmationCode: {
      code: 'eFHfeP7USO7xK5K4PKasrvh2ZxlwPvCEMFTW',
      expiresAt: new Date(Date.now() + 3600000)
    }
  })
})

afterAll(async () => {
  await User.deleteOne({ username: 'testuser3' })
  await mongoose.disconnect()
  await queueMQ.close()
  await bilbomdQueue.close()
  await new Promise((resolve) => server.close(resolve))
})

describe('TEST /verify API', () => {
  jest.setTimeout(5000)
  test('should return error if no verification code provided', async () => {
    let res = await request(server).post('/verify').send({ code: '' })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Confirmation code required.')
  })
  test('Should return error if no user found with that verification code', async () => {
    let res = await request(server).post('/verify').send({ code: '54321' })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Unable to verify 54321.')
  })
  test('Should return verification success', async () => {
    let res = await request(server)
      .post('/verify')
      .send({ code: 'eFHfeP7USO7xK5K4PKasrvh2ZxlwPvCEMFTW' })
    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe('Verified')
  })
})
