const fs = require('fs')
const swaggerSpec = require('./swaggerOptions')
const m2s = require('mongoose-to-swagger')

const User = require('./model/User')
const Job = require('./model/Job')

// Generate the Swagger definition for Mongoose/MongoDB schema
const userSwaggerDefinition = m2s(User)
const jobSwaggerDefinition = m2s(Job)

// Merge the User schema definition into your existing Swagger spec
// Add the User schema definition to your Swagger document
swaggerSpec.components = swaggerSpec.components || {}
swaggerSpec.components.schemas = swaggerSpec.components.schemas || {}
swaggerSpec.components.schemas.User = userSwaggerDefinition
swaggerSpec.components.schemas.Job = jobSwaggerDefinition

// Assuming Bearer authentication
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
fs.writeFileSync('swagger.json', JSON.stringify(swaggerSpec, null, 2))
