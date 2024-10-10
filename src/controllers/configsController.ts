import { Request, Response } from 'express'
import { logger } from '../middleware/loggers.js'
import axios from 'axios'

export const getConfigsStuff = async (req: Request, res: Response): Promise<void> => {
  logger.info('--- getConfigsStuff ---')

  try {
    // Fetch worker info
    const { data: workerInfo } = await axios.get(
      `${process.env.WORKER_SERVICE_URL || 'http://worker'}:${
        process.env.WORKER_SERVICE_PORT || 3000
      }/config`
    )
    // Fetch ui info
    const { data: uiInfo } = await axios.get(
      `${process.env.UI_SERVICE_URL || 'http://ui'}:${
        process.env.UI_SERVICE_PORT || 80
      }/version-info`
    )

    // Log environment variables for debugging
    const envVars = [
      'SFAPI_TOKEN_EXPIRES',
      'USE_NERSC',
      'NERSC_PROJECT',
      'SENDMAIL_USER',
      'BILBOMD_BACKEND_GIT_HASH',
      'BILBOMD_BACKEND_VERSION',
      'BILBOMD_ENV',
      'WORKER_SERVICE_URL',
      'WORKER_SERVICE_PORT',
      'ENABLE_BILBOMD_SANS'
    ]

    envVars.forEach((envVar) => {
      logger.info(`${envVar}: ${process.env[envVar]}`)
    })

    // Construct the response object
    const configs = {
      mode: process.env.BILBOMD_ENV || '',
      useNersc: process.env.USE_NERSC || 'false',
      nerscProject: process.env.NERSC_PROJECT || 'm1234',
      tokenExpires: process.env.SFAPI_TOKEN_EXPIRES || '2024-05-22 04:20',
      sendMailUser: process.env.SENDMAIL_USER || 'bilbomd@lbl.gov',
      enableBilboMdSANS: process.env.ENABLE_BILBOMD_SANS || 'true',
      backendVersion: process.env.BILBOMD_BACKEND_VERSION || '0.0.0',
      backendGitHash: process.env.BILBOMD_BACKEND_GIT_HASH || 'abc123',
      workerVersion: workerInfo.version || '0.0.0',
      workerGitHash: workerInfo.gitHash || 'abc123',
      uiVersion: uiInfo.version || '0.0.0',
      uiGitHash: uiInfo.gitHash || 'abc123'
    }

    res.json(configs)
  } catch (error) {
    logger.error(`Error fetching worker info or processing request: ${error}`)
    res.status(500).json({
      message: 'Failed to retrieve configuration information',
      error: error
    })
  }
}
