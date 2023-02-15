const { Queue } = require('bullmq')

const myQueue = new Queue('myQueue', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
})

const addThing = async (data) => {
  await myQueue.add('jobname', data)
  return 'yo'
}

module.exports = { addThing }
