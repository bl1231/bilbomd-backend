const fs = require('fs')
const swaggerSpec = require('./swaggerOptions')

fs.writeFileSync('swagger.json', JSON.stringify(swaggerSpec, null, 2))
