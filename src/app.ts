import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import path from 'path'
import cors from 'cors'
import { corsOptions } from './config/corsOptions'
import { logger, requestLogger, assignRequestId } from './middleware/loggers'
import cookieParser from 'cookie-parser'
import { router as adminRoutes } from './routes/admin'
import mongoose from 'mongoose'
import { connectDB } from './config/dbConn'
import { CronJob } from 'cron'
import { deleteOldJobs } from './middleware/jobCleaner'
import swaggerUi from 'swagger-ui-express'
import swaggerDocumentV1 from './openapi/v1/swagger_v1.json'

// Instantiate the app
const app: Express = express()

const environment: string = process.env.NODE_ENV || 'development'

logger.info(`Starting in ${environment} mode`)

// Trust the first proxy in front of the app
// ChatGPT suggested this
app.set('trust proxy', 1)

// Connect to MongoDB
connectDB()

// custom middleware logger
app.use(assignRequestId)
app.use(requestLogger)

// Cross Origin Resource Sharing
// prevents unwanted clients from accessing our backend API.
app.use(cors(corsOptions))

// built-in middleware to handle urlencoded FORM data
app.use(express.urlencoded({ extended: true, limit: '150mb' }))

// built-in middleware for JSON
app.use(express.json({ limit: '150mb' }))

// middleware for COOKIES
app.use(cookieParser())

// Serve static files
app.use('/', express.static('public'))

// Root routes (no version)
app.use('/', require('./routes/root'))

app.use('/admin/bullmq', adminRoutes)

app.use('/sfapi', require('./routes/sfapi'))

// Group version 1 routes under /api/v1
const v1Router = express.Router()

// Register v1 routes
v1Router.use('/register', require('./routes/register'))
v1Router.use('/verify', require('./routes/verify'))
v1Router.use('/magicklink', require('./routes/magicklink'))
v1Router.use('/auth', require('./routes/auth'))
v1Router.use('/jobs', require('./routes/jobs'))
v1Router.use('/users', require('./routes/users'))
v1Router.use('/af2pae', require('./routes/af2pae'))
v1Router.use('/autorg', require('./routes/autorg'))
v1Router.use('/bullmq', require('./routes/bullmq'))

// Apply v1Router under /api/v1
app.use('/api/v1', v1Router)

// Swagger documentation for Version 1
// Adjust Swagger documentation path
app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

// app.use('/v1/api-docs', express.static('./openapi/v1/swagger_v1.json'))
// app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

// cron
new CronJob('11 1 * * *', deleteOldJobs, null, true, 'America/Los_Angeles')
// job.start()

app.all('*', (req: Request, res: Response) => {
  res.status(404)
  if (req.accepts('html')) {
    console.log('__dirname:', __dirname)
    res.sendFile(path.join(__dirname, 'views', '404.html'))
  } else if (req.accepts('json')) {
    res.json({ error: '404 Not Found' })
  } else {
    res.type('txt').send('404 Not Found')
  }
})

mongoose.connection.on('error', (err) => {
  console.log('mongoose error: ', err)
  logger.error(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    'mongo_error.log'
  )
})

export default app
