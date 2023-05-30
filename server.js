require('dotenv').config()
global.__basedir = __dirname
require('express-async-errors')
const express = require('express')
// const expressWinston = require('express-winston')
const emoji = require('node-emoji')
const app = express()
const path = require('path')
const cors = require('cors')
const corsOptions = require('./config/corsOptions')
// const errorHandler = require('./middleware/errorHandler')
const { logger } = require('./middleware/loggers')
// const verifyJWT = require('./middleware/verifyJWT')
const cookieParser = require('cookie-parser')
// const credentials = require('./middleware/credentials')
const mongoose = require('mongoose')
const connectDB = require('./config/dbConn')
const PORT = process.env.BILBOMD_BACKEND_PORT || 3500
console.log('================================================')
// Connect to MongoDB
connectDB()

// custom middleware logger
// app.use(logger)
// app.use(
//   expressWinston.logger({
//     winstonInstance: requestLogger,
//     statusLevels: true
//   })
// )
// expressWinston.requestWhitelist.push('body')
// expressWinston.responseWhitelist.push('body')

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
app.use('/admin', require('./routes/admin'))

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

// This is to log application errors
// app.use(
//   expressWinston.errorLogger({
//     winstonInstance: logger
//   })
// )

// Only listen for traffic if we are actually connected to MongoDB.
mongoose.connection.once('connected', () => {
  console.log(emoji.get('rocket'), 'Connected to MongoDB', emoji.get('rocket'))
  app.listen(PORT, () =>
    console.log(
      emoji.get('white_check_mark'),
      `BilboMD Backend Server running on port ${PORT}`
    )
  )
})

mongoose.connection.on('error', (err) => {
  console.log(err)
  logger.error(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    'mongo_error.log'
  )
})

module.exports = app
