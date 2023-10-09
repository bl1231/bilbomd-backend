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
const swaggerDocument = require('./swagger.json')

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

// serve static files
app.use('/', express.static(path.join(__dirname, '/public')))

// our routes
app.use('/', require('./routes/root'))
app.use('/register', require('./routes/register'))
app.use('/verify', require('./routes/verify'))
app.use('/magicklink', require('./routes/magicklink'))
app.use('/auth', require('./routes/auth'))
app.use('/jobs', require('./routes/jobs'))
app.use('/users', require('./routes/users'))
app.use('/af2pae', require('./routes/af2pae'))
app.use('/autorg', require('./routes/autorg'))
app.use('/bullmq', require('./routes/bullmq'))
app.use('/admin', adminRoutes)
app.use('/api-docs', express.static('./swagger.json'))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup('./swagger.json'))

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
app.use((err, req, res) => {
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
