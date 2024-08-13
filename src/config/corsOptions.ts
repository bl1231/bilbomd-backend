import { allowedOrigins } from './allowedOrigins.js'
import { logger } from 'middleware/loggers.js'

const corsOptions = {
  origin: (
    origin: string | undefined,

    callback: (err: Error | null, allow: boolean) => void
  ) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      logger.error('CORS error: Origin not allowed:', origin)
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

export { corsOptions }
