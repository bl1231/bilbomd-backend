import fs from 'fs'
import m2s from 'mongoose-to-swagger'
import swaggerSpecJson from './swaggerOptions'
// import { User } from '../model/User'
// import { BilboMdJob } from '../model/Job'
import { User } from '@bl1231/bilbomd-mongodb-schema'
import { BilboMdJob } from '@bl1231/bilbomd-mongodb-schema'

// Assuming the types for these modules might not be available,
// and your models and swaggerOptions are correctly typed or accepted as any.
interface SwaggerSpec {
  openapi?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  components?: {
    schemas?: {
      [key: string]: any // Adjust based on your actual schema objects
    }
    securitySchemes?: {
      [key: string]: any // Adjust according to your needs
    }
  }
  security?: Array<{
    [key: string]: any // Adjust this part as necessary
  }>
}

const swaggerSpec: SwaggerSpec = swaggerSpecJson

// Generate the Swagger definition for Mongoose/MongoDB schema
const userSwaggerDefinition = m2s(User)
const bilboMdJobSwaggerDefinition = m2s(BilboMdJob)

// Merge the User schema definition into your existing Swagger spec
// Add the User schema definition to your Swagger document
swaggerSpec.components = swaggerSpec.components || {}
swaggerSpec.components.schemas = swaggerSpec.components.schemas || {}
swaggerSpec.components.schemas.User = userSwaggerDefinition
swaggerSpec.components.schemas.Jobs = bilboMdJobSwaggerDefinition

swaggerSpec.components.securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  },
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'jwt'
  }
}

// console.log(JSON.stringify(swaggerSpec, null, 2))

// Write the updated Swagger JSON to a file
fs.writeFileSync('src/openapi/v1/swagger_v1.json', JSON.stringify(swaggerSpec, null, 2))
