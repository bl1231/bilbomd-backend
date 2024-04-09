import swaggerJsdoc from 'swagger-jsdoc'
// import dotenv from 'dotenv'

// Initialize dotenv to use environment variables if not already done elsewhere in your project
// dotenv.config()

const VERSION = process.env.npm_package_version

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend',
      version: VERSION || 'w.t.f', // Provide a fallback version if npm_package_version is not set
      description: 'API documentation for bilbomd-backend'
    },
    servers: [
      {
        url: 'https://bilbomd.bl1231.als.lbl.gov/api/v1',
        description: 'production'
      },
      {
        url: 'http://localhost:3501/api/v1',
        description: 'development'
      }
    ]
  },
  apis: ['src/controllers/*.ts'] // Make sure this glob pattern matches your actual TypeScript files location
}

const swaggerSpecJson = swaggerJsdoc(options)

console.log(swaggerSpecJson)

export default swaggerSpecJson
