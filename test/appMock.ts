import express from 'express'
import cors from 'cors'
import registerRoutes from '../src/routes/register.js'
import verifyRoutes from '../src/routes/verify.js'
import magicklinkRoutes from '../src/routes/magicklink.js'
import usersRoutes from '../src/routes/users.js'
import jobsRoutes from '../src/routes/jobs.js'

const app = express()

app.use(cors())
app.use(express.json())

// Mount only the routes you want to test
app.use('/v1/register', registerRoutes)
app.use('/v1/verify', verifyRoutes)
app.use('/v1/magicklink', magicklinkRoutes)
app.use('/v1/users', usersRoutes)
app.use('/v1/jobs', jobsRoutes)

export default app
