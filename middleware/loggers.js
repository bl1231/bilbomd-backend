const { createLogger, transports, format } = require('winston')
const {
  splat,
  combine,
  timestamp,
  label,
  colorize,
  simple,
  json,
  printf,
  errors,
  prettyPrint
} = format

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
  return `${timestamp} - ${level}: [${label ? label : 'tbd'}]  ${message}`
})

// Format for console output
const consoleFormat = combine(
  colorize({ all: false }),
  splat(),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  label({ label: 'test' }),
  customFormat
)

// Format for log file
const fileFormat = combine(
  timestamp(),
  splat(),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  customFormat
)

// Create a Winston logger instance
const logger = createLogger({
  // levels: winston.config.syslog.levels,
  transports: [
    new transports.Console({
      format: consoleFormat
    }),
    new transports.File({
      level: 'error',
      filename: `${logsFolder}/bilbomd-backend-error.log`,
      format: json()
    }),
    new transports.File({
      level: 'info',
      filename: `${logsFolder}/bilbomd-backend.log`,
      format: json()
    })
  ]
})

// Create a Winston logger instance
const reqLogger = createLogger({
  transports: loggerRequestTransports,
  // format: combine(timestamp(), json(), prettyPrint())
  format: fileFormat
})

// Define a middleware function for request logging
const requestLogger = (req, res, next) => {
  // reqLogger.info(`${req.method} ${req.url}`)
  reqLogger.info(
    `${req.method} ${req.url} ${req.ip} ${req.ips} ${req.hostname} ${req.headers.origin}`
  )
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
