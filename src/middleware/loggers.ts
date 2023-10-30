import { createLogger, transports, format } from 'winston'
import { Request, Response, NextFunction } from 'express'
import moment from 'moment-timezone'

const { splat, combine, timestamp, label, colorize, json, printf, prettyPrint } = format
const localTimezone = 'America/Los_Angeles'
const customTimestamp = () => {
  return moment().tz(localTimezone).format('YYYY-MM-DD HH:mm:ss')
}
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
    format: customTimestamp
  }),
  label({ label: 'test' }),
  customFormat
)

// Format for log file
const fileFormat = combine(timestamp({ format: customTimestamp }), splat(), json())

// Create a Winston logger instance
const logger = createLogger({
  level: 'info',
  transports: [
    new transports.Console({
      format: consoleFormat
    }),
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
  format: combine(timestamp({ format: customTimestamp }), json(), prettyPrint())
})

// Define a middleware function for request logging
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
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

export { logger, requestLogger, logsFolder }
