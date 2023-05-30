const { createLogger, transports, format } = require('winston')
const { splat, combine, timestamp, colorize, simple, json } = format

const logsFolder = `./logs`

// Format for console output
const consoleFormat = combine(colorize(), splat(), simple())

// Format for log file
const fileFormat = combine(timestamp(), splat(), json())

// Create a Winston logger instance
const logger = createLogger({
  level: 'info',
  transports: [
    new transports.Console({
      format: consoleFormat
    }),
    new transports.File({
      filename: `${logsFolder}/error.log`,
      level: 'error',
      format: fileFormat
    }),
    new transports.File({ filename: `${logsFolder}/combined.log`, format: fileFormat })
  ]
})

module.exports = {
  logger,
  logsFolder
}
