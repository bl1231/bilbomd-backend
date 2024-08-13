import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import path from 'path'
import cors from 'cors'
import { corsOptions } from './config/corsOptions.js'
import { logger, requestLogger, assignRequestId } from './middleware/loggers.js'
import cookieParser from 'cookie-parser'
import { router as adminRoutes } from './routes/admin.js'
import mongoose from 'mongoose'
import { connectDB } from './config/dbConn.js'
import { CronJob } from 'cron'
import { deleteOldJobs } from './middleware/jobCleaner.js'
// import swaggerUi from 'swagger-ui-express'
// import swaggerDocumentV1 from './openapi/v1/swagger_v1.json'
import rootRoutes from './routes/root.js'
import sfapiRoutes from './routes/sfapi.js'
import registerRoutes from './routes/register.js'
import verifyRoutes from './routes/verify.js'
import magicklinkRoutes from './routes/magicklink.js'
import authRoutes from './routes/auth.js'
import jobsRoutes from './routes/jobs.js'
import usersRoutes from './routes/users.js'
import af2paeRoutes from './routes/af2pae.js'
import autorgRoutes from './routes/autorg.js'
import bullmqRoutes from './routes/bullmq.js'
import configsRoutes from './routes/configs.js'

// Instantiate the app
const app: Express = express()

const environment: string = process.env.NODE_ENV || 'development'

const viewsPath = '/app/views'

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
app.use('/', rootRoutes)

app.use('/admin/bullmq', adminRoutes)

app.use('/sfapi', sfapiRoutes)

// Group version 1 routes under /api/v1
const v1Router = express.Router()

// Register v1 routes
v1Router.use('/register', registerRoutes)
v1Router.use('/verify', verifyRoutes)
v1Router.use('/magicklink', magicklinkRoutes)
v1Router.use('/auth', authRoutes)
v1Router.use('/jobs', jobsRoutes)
v1Router.use('/users', usersRoutes)
v1Router.use('/af2pae', af2paeRoutes)
v1Router.use('/autorg', autorgRoutes)
v1Router.use('/bullmq', bullmqRoutes)
v1Router.use('/configs', configsRoutes)

// Apply v1Router under /api/v1
app.use('/api/v1', v1Router)

// Swagger documentation for Version 1
// Adjust Swagger documentation path
// app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

// app.use('/v1/api-docs', express.static('./openapi/v1/swagger_v1.json'))
// app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

// cron
new CronJob('11 1 * * *', deleteOldJobs, null, true, 'America/Los_Angeles')
// job.start()

app.all('*', (req: Request, res: Response) => {
  res.status(404)
  if (req.accepts('html')) {
    res.sendFile(path.join(viewsPath, '404.html'))
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
