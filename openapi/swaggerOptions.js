const swaggerJsdoc = require('swagger-jsdoc')

const VERSION = process.env.npm_package_version

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend',
      version: VERSION,
      description: 'API documentation for bilbomd-backend'
    },
    servers: [
      {
        url: 'https://bl1231.als.lbl.gov/bilbomd-dev-backend/v1',
        description: 'production'
      },
      {
        url: 'http://localhost:3501/v1',
        description: 'development'
      }
    ]
  },
  apis: ['./controllers/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

console.log(swaggerSpec)

module.exports = swaggerSpec
