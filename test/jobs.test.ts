import request from 'supertest'
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs-extra'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
// import { closeQueue } from '../src/queues/bilbomd'
import app from './appMock'
import { User, IUser, Job } from '@bl1231/bilbomd-mongodb-schema'

vi.mock('bullmq')

let server: any
let testUser1: IUser

const accessTokenSecret: string = process.env.ACCESS_TOKEN_SECRET ?? ''
const dataVolume: string = process.env.DATA_VOL ?? ''

interface JwtPayload {
  UserInfo: BilboMDJwtPayload
}

interface BilboMDJwtPayload {
  username: string
  roles: string[]
  email: string
}

interface JobType {
  mongo: {
    __v: number
    _id: string
    crd_file: string
    createdAt: string
    data_file: string
    psf_file: string
    status: string
    time_submitted: string
    title: string
    updatedAt: string
    user: string
    uuid: string
  }
  username: string
}

const generateAccessToken = (): string => {
  const accessTokenPayload: JwtPayload = {
    UserInfo: {
      username: 'testuser1',
      roles: ['User'],
      email: 'testuser1@example.com'
    }
  }

  const accessToken: string = jwt.sign(accessTokenPayload, accessTokenSecret, {
    expiresIn: '15m'
  })
  // const accessTokenData: AccessToken = {
  //   accessToken
  // }
  return accessToken
}

const createNewJob = async (user: IUser) => {
  const now = new Date()
  const UUID = uuid()
  const jobDir = path.join(dataVolume, UUID)
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
  // Create test user for setup (ignoring the warning)

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
  // await mongoose.disconnect()
  // await closeQueue()
  await new Promise((resolve) => server.close(resolve))
})

describe('GET /v1/jobs', () => {
  //Test cases for the GET /v1/jobs endpoint
  test('should return error if unauthorized', async () => {
    expect.assertions(2)
    const res = await request(server).get('/v1/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if no jobs found', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
    console.log('no jobs', res.statusCode, res.body)
    expect(res.statusCode).toBe(204)
    expect(res.body).toEqual({})
  })
  test('should return success with list of jobs', async () => {
    expect.assertions(3)
    await createNewJob(testUser1)
    const token = generateAccessToken()
    const res = await request(server)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(200)
    // console.log(res.body)
    expect(res.body).toBeDefined()
    const jobsArray: JobType[] = res.body
    const matchingJob = jobsArray.find(
      (job) => job.mongo.title === 'test job' && job.username === 'testuser1'
    )
    expect(matchingJob).toBeDefined()
  })
})

describe('GET /v1/jobs/:id', () => {
  test('should return error if unauthorized', async () => {
    expect.assertions(2)
    const id = new mongoose.Types.ObjectId().toString()
    const res = await request(server).get(`/v1/jobs/${id}`)
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if jobid doesnt exist', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const id = new mongoose.Types.ObjectId().toString()
    const res = await request(server)
      .get(`/v1/jobs/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(404)
    expect(res.body.message).toBe(`No job matches ID ${id}.`)
  })
  test('should return success if job is found', async () => {
    const token = generateAccessToken()
    const newJob = await createNewJob(testUser1)
    const res = await request(server)
      .get(`/v1/jobs/${newJob._id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeDefined()
  })
})

describe('POST /v1/jobs', () => {
  //Test cases for the POST /v1/jobs endpoint
  test('should return error if unauthorized', async () => {
    expect.assertions(2)
    const res = await request(server).post('/v1/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  test('should return error if user not found', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('inp_file', `${__dirname}/data/my_const.inp`)
      .attach('dat_file', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('title', 'Test Job')
      .field('email', 'non-existant@example.com')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('No user found with that email')
  })
  test('should return error if no job type provided', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('inp_file', `${__dirname}/data/my_const.inp`)
      .attach('dat_file', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('title', 'Test Job')
      .field('email', 'testuser1@example.com')
      .field('rg_min', 30)
      .field('rg_max', 40)
      .field('num_conf', 1)
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('No job type provided')
  })
  test('should return error if wrong job type provided', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('inp_file', `${__dirname}/data/my_const.inp`)
      .attach('dat_file', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('title', 'Test Job')
      .field('email', 'testuser1@example.com')
      .field('rg_min', 30)
      .field('rg_max', 40)
      .field('num_conf', 1)
      .field('job_type', 'BilboMDWrongType')
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Invalid job type')
  })
  test('should return success if new BilboMD job created', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'BilboMD Test Job')
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('inp_file', `${__dirname}/data/my_const.inp`)
      .attach('dat_file', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('email', 'testuser1@example.com')
      .field('rg_min', 30)
      .field('rg_max', 40)
      .field('num_conf', 1)
      .field('job_type', 'BilboMD')
    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe('New BilboMD Job successfully created')
  })
  test('should return success if new BilboMDAuto job created', async () => {
    expect.assertions(2)
    const token = generateAccessToken()
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'BilboMDAuto Test Job')
      .attach('psf_file', `${__dirname}/data/pro_dna_complex.psf`)
      .attach('crd_file', `${__dirname}/data/pro_dna_complex.crd`)
      .attach('pae_file', `${__dirname}/data/pae.json`)
      .attach('dat_file', `${__dirname}/data/pro_dna_saxs.dat`)
      .field('email', 'testuser1@example.com')
      .field('job_type', 'BilboMDAuto')
    // console.log('res----->', res)
    expect(res.statusCode).toBe(200)
    expect(res.body.message).toBe('New BilboMDAuto Job successfully created')
  })
})

describe('PATCH /v1/jobs', () => {
  //Test cases for the PATCH /v1/jobs endpoint
  test('should return error if unauthorized', async () => {
    const res = await request(server).patch('/v1/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
})

describe('DELETE /v1/jobs/:id', () => {
  //Test cases for the DELETE /v1/jobs endpoint
  test('should return error if unauthorized', async () => {
    expect.assertions(2)
    const res = await request(server).delete('/v1/jobs')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Unauthorized')
  })
  // test('should return error if Job ID not provided', async () => {
  //   const token = generateAccessToken()
  //   const res = await request(server)
  //     .delete('/v1/jobs/1234')
  //     .set('Authorization', `Bearer ${token}`)
  //   expect(res.statusCode).toBe(400)
  //   expect(res.body.message).toBe('Job ID required')
  // })
  test('should return error if Job ID not found', async () => {
    const token = generateAccessToken()
    const id = new mongoose.Types.ObjectId().toString()
    const res = await request(server)
      .delete(`/v1/jobs/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Job not found')
  })
  test('should return error if directory not on disk', async () => {
    const token = generateAccessToken()
    // This creates a new Job in the database
    const newJob = await createNewJob(testUser1)
    const res = await request(server)
      .delete(`/v1/jobs/${newJob._id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.statusCode).toBe(404)
    expect(res.body.message).toBe('Directory not found on disk')
  })
  test('should delete Job and return success', async () => {
    const token = generateAccessToken()
    // This creates a new Job in the database
    const newJob = await createNewJob(testUser1)
    // Need to also create the Job on disk
    const jobDir = path.join(dataVolume, newJob.uuid)
    await fs.mkdir(jobDir, { recursive: true })
    // console.log('newJob: ', newJob)
    const res = await request(server)
      .delete(`/v1/jobs/${newJob._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ id: newJob._id })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeDefined()
  })
})
