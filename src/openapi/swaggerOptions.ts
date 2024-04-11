import swaggerJsdoc from 'swagger-jsdoc'

const VERSION = process.env.npm_package_version

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BilboMD Backend',
      version: VERSION || 'w.t.f',
      description: 'API documentation for bilbomd-backend'
    },
    servers: [
      {
        url: 'https://bilbomd.bl1231.als.lbl.gov/api/v1',
        description: 'production'
      },
      {
        url: 'http://localhost:3001/api/v1',
        description: 'development'
      }
    ]
  },
  apis: ['src/controllers/*.ts']
}

const swaggerSpecJson = swaggerJsdoc(options)

console.log(swaggerSpecJson)

export default swaggerSpecJson
