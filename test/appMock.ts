import express from 'express'
import cors from 'cors'
import registerRoutes from '../src/routes/register.js'
import verifyRoutes from '../src/routes/verify.js'

const app = express()

app.use(cors())
app.use(express.json())

// Mount only the routes you want to test
app.use('/v1/register', registerRoutes)
app.use('/v1/verify', verifyRoutes)

export default app
