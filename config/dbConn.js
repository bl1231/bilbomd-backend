const mongoose = require('mongoose')

const { MONGO_USERNAME, MONGO_PASSWORD, MONGO_HOSTNAME, MONGO_PORT, MONGO_DB } =
  process.env

const url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 10000
}

const connectDB = async () => {
  try {
    await mongoose.set('strictQuery', false)
    await mongoose.connect(url, options)
  } catch (err) {
    console.error('here--> ', err)
  }
}

module.exports = connectDB
