const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend', // Title of your API
      version: '0.0.14', // Version of your API
      description: 'API documentation for bilbomd-backend'
    }
  },
  apis: ['./controllers/*.js'] // Specify the path to your route files
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec
