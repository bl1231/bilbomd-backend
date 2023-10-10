const swaggerJsdoc = require('swagger-jsdoc')

// const VERSION = '@VERSION@'
const VERSION = process.env.npm_package_version

const options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend',
      version: VERSION,
      description: 'API documentation for bilbomd-backend'
    }
  },
  apis: ['./controllers/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec
