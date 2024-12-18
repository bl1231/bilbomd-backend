import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import path from 'path'
import { connectDB } from '../src/config/dbConn'
// import cors from 'cors'
// import { corsOptions } from './config/corsOptions'
// import { logger } from '../src/middleware/loggers'
import cookieParser from 'cookie-parser'
// import { router as adminRoutes } from './routes/admin'
// import mongoose from 'mongoose'

// import { CronJob } from 'cron'

const app: Express = express()

// Connect to MongoDB
connectDB()

// custom middleware logger
// app.use(requestLogger)

// Cross Origin Resource Sharing
// prevents unwanted clients from accessing our backend API.
// app.use(cors(corsOptions))

// built-in middleware to handle urlencoded FORM data
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// built-in middleware for JSON
app.use(express.json({ limit: '5mb' }))

// middleware for COOKIES
app.use(cookieParser())

// Serve static files
app.use('/', express.static('public'))

// Root routes (no version)
// app.use('/', require('../src/routes/root'))

// Version 1 routes
app.use('/v1/register', require('../src/routes/register'))
app.use('/v1/verify', require('../src/routes/verify'))
app.use('/v1/magicklink', require('../src/routes/magicklink'))
// app.use('/v1/auth', require('../src/routes/auth'))
app.use('/v1/jobs', require('../src/routes/jobs'))
app.use('/v1/users', require('../src/routes/users'))
// app.use('/v1/af2pae', require('../src/routes/af2pae'))
// app.use('/v1/autorg', require('../src/routes/autorg'))
app.use('/v1/bullmq', require('./routes/bullmqMock'))
// app.use('/v1/admin', adminRoutes)

// Swagger documentation for Version 1
// app.use('/v1/api-docs', express.static('./openapi/v1/swagger_v1.json'))
// app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

// cron
// new CronJob('11 1 * * *', deleteOldJobs, null, true, 'America/Los_Angeles')
// job.start()

app.all('*', (req: Request, res: Response) => {
  res.status(404)
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'views', '404.html'))
  } else if (req.accepts('json')) {
    res.json({ error: '404 Not Found' })
  } else {
    res.type('txt').send('404 Not Found')
  }
})

// mongoose.connection.on('error', (err) => {
//   console.log('mongoose error: ', err)
//   logger.error(
//     `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
//     'mongo_error.log'
//   )
// })

export default app
