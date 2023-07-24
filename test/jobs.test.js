const request = require('supertest')
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs-extra')
const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const { queueMQ } = require('../routes/admin')
const { bilbomdQueue } = require('../queues/jobQueue')
const app = require('../app')
const User = require('../model/User')
const Job = require('../model/Job')
require('dotenv').config()
let server
let testUser1

const generateAccessToken = () => {
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

const createNewJob = async (user) => {
  const now = new Date()
  const UUID = uuid()
  const jobDir = path.join(process.env.DATA_VOL, UUID)
  const job = {
    title: 'test job',
    uuid: UUID,
    psf_file: `${jobDir}/pro_dna_complex.psf`,
    crd_file: `${jobDir}/pro_dna_complex.crd`,
    const_inp_file: `${jobDir}/my_const.inp`,
    data_file: `${jobDir}/pro_dna_saxs.dat`,
    conformational_sampling: 1,
    rg_min: 25,
    rg_max: 35,
    status: 'Submitted',
    time_submitted: now,
    user: user
  }
  // console.log(job)
  const createdJob = await Job.create(job)
  return createdJob
}

beforeAll(async () => {
  server = app.listen(5555)
  await User.deleteMany()
  await Job.deleteMany()
  // Create test user for jobs tests
  testUser1 = await User.create({
    username: 'testuser1',
    email: 'testuser1@example.com',
    roles: ['User'],
    confirmationCode: { code: '12345', expiresAt: new Date(Date.now() + 3600000) }
  })
})

afterAll(async () => {
  await User.deleteMany()
  await Job.deleteMany()
  await mongoose.disconnect()
  await queueMQ.close()
  await bilbomdQueue.close()
  await new Promise((resolve) => server.close(resolve))
})

describe('GET /jobs', () => {
  //Test cases for the GET /jobs endpoint
  test('should return error if unauthorized', async () => {
    let res = await request(server).get('/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if no jobs found', async () => {
    const token = generateAccessToken()
    let res = await await request(server)
      .get('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('No jobs found')
  })
  test('should return success with list of jobs', async () => {
    await createNewJob(testUser1)
    const token = generateAccessToken()
    let res = await await request(server)
      .get('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    expect(res.statusCode).toBe(200)
    // console.log(res.body)
    expect(res.body).toBeDefined()
    expect(res.body).toContainEqual(expect.objectContaining({ title: 'test job' }))
    expect(res.body).toContainEqual(expect.objectContaining({ username: 'testuser1' }))
  })
})

describe('GET /jobs/:id', () => {
  test('should return error if unauthorized', async () => {
    const id = new mongoose.Types.ObjectId().toString()
    let res = await request(server).get(`/jobs/${id}`)
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if jobid doesnt exist', async () => {
    const token = generateAccessToken()
    const id = new mongoose.Types.ObjectId().toString()
    let res = await request(server)
      .get(`/jobs/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(404)
    expect(res.body.message).toBe(`No job matches ID ${id}.`)
  })
  test('should return success if job is found', async () => {
    const token = generateAccessToken()
    const newJob = await createNewJob(testUser1)
    let res = await request(server)
      .get(`/jobs/${newJob._id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeDefined()
  })
})

describe('POST /jobs', () => {
  //Test cases for the POST /jobs endpoint
  test('should return error if unauthorized', async () => {
    let res = await request(server).post('/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if user not found', async () => {
    const token = generateAccessToken()
    let res = await request(server)
      .post('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('constinp', `${__dirname}/data/my_const.inp`)
      .attach('expdata', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('title', 'Test Job')
      .field('email', 'non-existant@example.com')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('No user found with that email')
  })
  test('should return create new job and return success', async () => {
    const token = generateAccessToken()
    let res = await request(server)
      .post('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('constinp', `${__dirname}/data/my_const.inp`)
      .attach('expdata', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('title', 'Test Job')
      .field('email', 'testuser1@example.com')
      .field('rg_min', 30)
      .field('rg_max', 40)
      .field('num_conf', 1)
    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe('New BilboMD Job successfully created')
  })
})

describe('PATCH /jobs', () => {
  //Test cases for the PATCH /jobs endpoint
  test('should return error if unauthorized', async () => {
    let res = await request(server).patch('/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
})

describe('DELETE /jobs', () => {
  //Test cases for the DELETE /jobs endpoint
  test('should return error if unauthorized', async () => {
    let res = await request(server).delete('/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if Job ID not provided', async () => {
    const token = generateAccessToken()
    let res = await request(server)
      .delete('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Job ID required')
  })
  test('should return error if Job ID not found', async () => {
    const token = generateAccessToken()
    const id = new mongoose.Types.ObjectId().toString()
    let res = await request(server)
      .delete('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ id })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Job not found')
  })
  test('should return error if directory not on disk', async () => {
    const token = generateAccessToken()
    // This creates a new Job in the database
    const newJob = await createNewJob(testUser1)
    let res = await request(server)
      .delete('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: newJob._id })
    expect(res.statusCode).toBe(404)
    expect(res.body.message).toBe('Directory not found on disk')
  })
  test('should delete Job and return success', async () => {
    const token = generateAccessToken()
    // This creates a new Job in the database
    const newJob = await createNewJob(testUser1)
    // Need to also create the Job on disk
    const jobDir = path.join(process.env.DATA_VOL, newJob.uuid)
    await fs.mkdir(jobDir, { recursive: true })
    // console.log('newJob: ', newJob)
    let res = await request(server)
      .delete('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: newJob._id })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeDefined()
  })
})