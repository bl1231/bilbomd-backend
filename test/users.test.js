const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')
const app = require('../app')
const User = require('../model/User')
let server
require('dotenv').config()

const generateValidToken = () => {
  const user = {
    username: 'testuser1',
    email: 'testuser1@example.com',
    roles: ['User']
  }

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: user.username,
        roles: user.roles,
        email: user.email
      }
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  )
  return accessToken
}

beforeAll(async () => {
  server = app.listen(5555)
  await User.deleteMany()
})

afterAll(async () => {
  // await User.deleteOne({ username: 'testuser3' })
  await mongoose.disconnect()
  await queueMQ.close()
  await bilbomdQueue.close()
  await new Promise((resolve) => server.close(resolve))
})

// beforeEach(async () => {
//   await User.deleteMany()
// })

//GET
describe('GET /users API', () => {
  jest.setTimeout(5000)
  let testUser1 // Declare a variable to store the test user
  let testUser2 // Declare a variable to store the test user

  beforeEach(async () => {
    // Create the test user and store it in the variable
    testUser1 = await User.create({
      username: 'testuser1',
      email: 'testuser1@example.com',
      roles: ['User'],
      confirmationCode: { code: '12345', expiresAt: new Date(Date.now() + 3600000) }
    })
    testUser2 = await User.create({
      username: 'testuser2',
      email: 'testuser2@example.com',
      roles: ['User'],
      confirmationCode: { code: '54321', expiresAt: new Date(Date.now() + 3600000) }
    })
  })
  afterEach(async () => {
    // Delete the test user after each test case
    await User.deleteOne({ _id: testUser1._id })
    await User.deleteOne({ _id: testUser2._id })
  })
  test('should return error if we are unauthorized', async () => {
    let res = await request(server).get('/users')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return users', async () => {
    const token = generateValidToken()
    let res = await await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeDefined()
    // Check if testuser1 and testuser2 are present in the response body
    expect(res.body).toContainEqual(expect.objectContaining({ username: 'testuser1' }))
    expect(res.body).toContainEqual(expect.objectContaining({ username: 'testuser2' }))
  })
})

describe('PATCH /users API', () => {
  // Test cases for the PATCH /users endpoint
  jest.setTimeout(5000)
  let testUser1 // Declare a variable to store the test user
  let token // Declare a variable to store the access token
  beforeEach(async () => {
    token = generateValidToken()
    // Create the test user and store it in the variable
    testUser1 = await User.create({
      username: 'testuser1',
      email: 'testuser1@example.com',
      roles: ['User'],
      confirmationCode: { code: '12345', expiresAt: new Date(Date.now() + 3600000) }
    })
  })
  afterEach(async () => {
    // Delete the test user after each test case
    await User.deleteOne({ _id: testUser1._id })
  })
  test('should return error if we are unauthorized', async () => {
    let res = await request(server).patch('/users')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if you dont provide valid user object', async () => {
    const token = generateValidToken()
    let res = await await request(server)
      .patch('/users')
      .send({})
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    // console.log(res.body)
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('All fields are required')
  })
  test('should return error if user is not found', async () => {
    // const token = generateValidToken()
    const id = new mongoose.Types.ObjectId().toString()
    // console.log('id:', id)
    const user = {}
    user.id = id
    user.username = testUser1.username
    user.roles = testUser1.roles
    user.active = testUser1.active
    user.email = testUser1.email
    // console.log('in jest test before patch', user)
    let res = await await request(server)
      .patch('/users')
      .send(user)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    // console.log('response body:', res.body)
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('User not found')
  })
  test('should return success if user is updated', async () => {
    const user = {}
    user.id = testUser1._id
    user.username = testUser1.username
    user.roles = testUser1.roles
    user.active = testUser1.active
    user.email = 'updated@example.com'

    let res = await await request(server)
      .patch('/users')
      .send(user)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')

    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe(`${user.username} updated`)
  })
})

describe('DELETE /users API', () => {
  // Test cases for the DELETE /users endpoint
})
