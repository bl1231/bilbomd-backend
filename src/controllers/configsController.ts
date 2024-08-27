import { Request, Response } from 'express'
import { logger } from '../middleware/loggers.js'
import axios from 'axios'

export const getConfigsStuff = async (req: Request, res: Response) => {
  logger.info(`process.env.SFAPI_TOKEN_EXPIRES: ${process.env.SFAPI_TOKEN_EXPIRES}`)
  logger.info(`process.env.USE_NERSC: ${process.env.USE_NERSC}`)
  logger.info(`process.env.NERSC_PROJECT: ${process.env.NERSC_PROJECT}`)

  const workerInfo = await axios.get('http://worker-service/worker-info')

  const configs = {
    tokenExpires: process.env.SFAPI_TOKEN_EXPIRES || '2024-05-22 04:20',
    useNersc: process.env.USE_NERSC || 'false',
    nerscProject: process.env.NERSC_PROJECT || 'm1234',
    sendMailUser: process.env.SENDMAIL_USER || 'bilbomd@lbl.gov',
    gitHash: process.env.GIT_HASH || '',
    mode: process.env.BILBOMD_ENV || '',
    workerVersion: workerInfo.data.version || '',
    workerGitHash: workerInfo.data.gitHash || ''
  }

  // If the environment variable is not set, return an error
  // if (!tokenExpires) {
  //   return res
  //     .status(500)
  //     .json({ message: 'SFAPI token expiration date not set in environment variables' })
  // }

  return res.json(configs)
}
