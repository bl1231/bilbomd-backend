const allowedOrigins = require('./allowedOrigins')

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      console.log('Allowed by CORS')
      callback(null, true)
    } else {
      console.log('NOT Allowed by CORS')
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

module.exports = corsOptions
