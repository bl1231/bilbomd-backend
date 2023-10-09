const mongoose = require('mongoose')
const { logger } = require('../middleware/loggers')
const {
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_PORT,
  MONGO_DB,
  MONGO_AUTH_SRC
} = process.env

const url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=${MONGO_AUTH_SRC}`

// const options = {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   connectTimeoutMS: 10000
// }

const connectDB = async () => {
  // logger.info('MongoDB URL: %s', url)
  try {
    mongoose.set('strictQuery', false)
    await mongoose.connect(url)
  } catch (error) {
    logger.error('Error connecting to MongoDB: %s', error)
  }
}

module.exports = connectDB
