import { allowedOrigins } from '../config/allowedOrigins.js'
import { Request, Response, NextFunction } from 'express'

const credentials = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Credentials', 'true')
    }
  }
  next()
}

module.exports = credentials
