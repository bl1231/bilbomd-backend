const mongoose = require('mongoose')

const {
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_PORT,
  MONGO_DB,
  MONGO_AUTH_SRC
} = process.env

const url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=${MONGO_AUTH_SRC}`

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 10000
}

const connectDB = async () => {
  console.log(url)
  try {
    // await mongoose.set('strictQuery', false)
    await mongoose.connect(url, options)
  } catch (err) {
    console.error(err)
  }
}

module.exports = connectDB
