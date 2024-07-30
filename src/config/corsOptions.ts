import { allowedOrigins } from './allowedOrigins'
import { logger } from '../middleware/loggers'

const corsOptions = {
  origin: (
    origin: string | undefined,
    /* eslint-disable no-unused-vars */
    callback: (err: Error | null, allow: boolean) => void
    /* eslint-enable no-unused-vars */
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
