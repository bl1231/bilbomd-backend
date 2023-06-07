const { createLogger, transports, format } = require('winston')
const { splat, combine, timestamp, label, colorize, simple, json, printf, prettyPrint } =
  format

const logsFolder = `./logs`

// const getLabel = (callingModule) => {
//   const parts = callingModule.filename.split('/')
//   const thing = parts[parts.length - 2] + '/' + parts.pop()
//   console.log(thing)
//   return parts[parts.length - 2] + '/' + parts.pop()
// }

// Transports for request Logger
const loggerRequestTransports = [
  new transports.File({
    level: 'warn',
    filename: `${logsFolder}/bilbomd-backend-req-warn.log`
  }),
  new transports.File({
    level: 'error',
    filename: `${logsFolder}/bilbomd-backend-req-error.log`
  }),
  new transports.File({
    level: 'info',
    filename: `${logsFolder}/bilbomd-backend-req-info.log`
  })
]

//Custom format using the printf format.
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} - ${level}: [${label}]  ${message}`
})

// Format for console output
const consoleFormat = combine(
  colorize({ all: true }),
  splat(),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  label({ label: 'test' }),
  customFormat
)

// Format for log file
const fileFormat = combine(timestamp(), splat(), json())

// Create a Winston logger instance
const logger = createLogger({
  level: 'info',
  transports: [
    // new transports.Console({
    //   format: consoleFormat
    // }),
    new transports.File({
      filename: `${logsFolder}/bilbomd-backend-error.log`,
      level: 'error',
      format: fileFormat
    }),
    new transports.File({
      filename: `${logsFolder}/bilbomd-backend.log`,
      format: fileFormat
    })
  ]
})

// Create a Winston logger instance
const reqLogger = createLogger({
  transports: loggerRequestTransports,
  format: combine(timestamp(), json(), prettyPrint())
})

// Define a middleware function for request logging
const requestLogger = (req, res, next) => {
  reqLogger.info(`${req.method} ${req.url}`)
  next()
}

// Not sure this is working?
// if (process.env.NODE_ENV !== 'production') {
//   // loggerTransports.push(new transports.Console())

//   loggerRequestTransports.push(
//     new transports.File({
//       level: 'info',
//       filename: `${logsFolder}/requestInfo.log`
//     })
//   )
// }

module.exports = {
  logger,
  requestLogger,
  logsFolder
}
