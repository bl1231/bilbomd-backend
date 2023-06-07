const app = require('./app')
const PORT = process.env.BILBOMD_BACKEND_PORT || 3500
// const PORT = 3500

const server = app.listen(PORT, () =>
  console.log(`BilboMD server starting on port ${PORT}`)
)

// Cleanup logic
const cleanup = async () => {
  if (server !== null) {
    console.log('Closing ExpressJS server')
    await server.close((err) => {
      console.log('Closed ExpressJS server')
      process.exit(err ? 1 : 0)
    })
  }
}

// Handle process termination signals
process.on('SIGINT', async () => {
  console.log('Received SIGINT signal in server.js')
  await cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal in server.js')
  await cleanup()
  process.exit(0)
})
