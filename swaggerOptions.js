const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend',
      version: '0.0.14',
      description: 'API documentation for bilbomd-backend'
    }
  },
  apis: ['./controllers/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec
