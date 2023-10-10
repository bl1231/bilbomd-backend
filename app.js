require('dotenv').config()
global.__basedir = __dirname
require('express-async-errors')
const express = require('express')
const app = express()
const path = require('path')
const cors = require('cors')
const corsOptions = require('./config/corsOptions')
const { logger, requestLogger } = require('./middleware/loggers')
const cookieParser = require('cookie-parser')
const { router: adminRoutes } = require('./routes/admin')
const mongoose = require('mongoose')
const connectDB = require('./config/dbConn')
const swaggerUi = require('swagger-ui-express')
const swaggerDocumentV1 = require('./openapi/v1/swagger_v1.json')
// const swaggerDocumentV2 = require('./swagger_v2.json')

// Connect to MongoDB
connectDB()

// custom middleware logger
app.use(requestLogger)

// Cross Origin Resource Sharing
// prevents unwanted clients from accessing our backend API.
app.use(cors(corsOptions))

// built-in middleware to handle urlencoded FORM data
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// built-in middleware for JSON
app.use(express.json({ limit: '5mb' }))

// middleware for COOKIES
app.use(cookieParser())

// Serve static files
app.use('/', express.static(path.join(__dirname, '/public')))

// Root routes (no version)
app.use('/', require('./routes/root'))

// Version 1 routes
app.use('/v1/register', require('./routes/register'))
app.use('/v1/verify', require('./routes/verify'))
app.use('/v1/magicklink', require('./routes/magicklink'))
app.use('/v1/auth', require('./routes/auth'))
app.use('/v1/jobs', require('./routes/jobs'))
app.use('/v1/users', require('./routes/users'))
app.use('/v1/af2pae', require('./routes/af2pae'))
app.use('/v1/autorg', require('./routes/autorg'))
app.use('/v1/bullmq', require('./routes/bullmq'))
app.use('/v1/admin', adminRoutes)

// Swagger documentation for Version 1
app.use('/v1/api-docs', express.static('./openapi/v1/swagger_v1.json'))
app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocumentV1))

app.all('*', (req, res) => {
  res.status(404)
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'views', '404.html'))
  } else if (req.accepts('json')) {
    res.json({ error: '404 Not Found' })
  } else {
    res.type('txt').send('404 Not Found')
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.message)
  res.status(500).json({ error: 'Internal server error' })
})

mongoose.connection.on('error', (err) => {
  console.log('mongoose error: ', err)
  logger.error(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    'mongo_error.log'
  )
})

module.exports = app
