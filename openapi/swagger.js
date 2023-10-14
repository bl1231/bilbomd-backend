const fs = require('fs')
const swaggerSpec = require('./swaggerOptions')
const m2s = require('mongoose-to-swagger')

const User = require('../model/User')
// const Job = require('../model/JobTest')
// const BilboMdJob = require('../model/Job')
// const BilboMdAutoJob = require('../model/Job')

// Generate the Swagger definition for Mongoose/MongoDB schema
const userSwaggerDefinition = m2s(User)
// const jobSwaggerDefinition = m2s(Job)
// const bilboMdJobSwaggerDefinition = m2s(BilboMdJob)
// const bilboMdAutoJobSwaggerDefinition = m2s(BilboMdAutoJob)

// Merge the User schema definition into your existing Swagger spec
// Add the User schema definition to your Swagger document
swaggerSpec.components = swaggerSpec.components || {}
swaggerSpec.components.schemas = swaggerSpec.components.schemas || {}
swaggerSpec.components.schemas.User = userSwaggerDefinition
// swaggerSpec.components.schemas.Job = jobSwaggerDefinition
// swaggerSpec.components.schemas.BilboMDJob = bilboMdJobSwaggerDefinition
// swaggerSpec.components.schemas.BilboMDAutoJob = bilboMdAutoJobSwaggerDefinition

// Add Bearer authentication
swaggerSpec.security = [
  {
    bearerAuth: []
  }
]

swaggerSpec.components.securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  }
}

// Write the updated Swagger JSON to a file
fs.writeFileSync('openapi/v1/swagger_v1.json', JSON.stringify(swaggerSpec, null, 2))
