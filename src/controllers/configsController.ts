import { Request, Response } from 'express';
import { logger } from '../middleware/loggers.js';
import axios from 'axios';

export const getConfigsStuff = async (req: Request, res: Response) => {
  logger.info('--- getConfigsStuff ---');

  try {
    // Fetch worker info
    const { data: workerInfo } = await axios.get(
      `${process.env.WORKER_SERVICE_URL || 'http://worker'}:${
        process.env.WORKER_SERVICE_PORT || 3000
      }/worker-info`
    );

    // Log environment variables for debugging
    const envVars = [
      'SFAPI_TOKEN_EXPIRES',
      'USE_NERSC',
      'NERSC_PROJECT',
      'SENDMAIL_USER',
      'GIT_HASH',
      'BILBOMD_ENV',
      'WORKER_SERVICE_URL',
      'WORKER_SERVICE_PORT',
    ];

    envVars.forEach((envVar) => {
      logger.info(`${envVar}: ${process.env[envVar]}`);
    });

    // Construct the response object
    const configs = {
      tokenExpires: process.env.SFAPI_TOKEN_EXPIRES || '2024-05-22 04:20',
      useNersc: process.env.USE_NERSC || 'false',
      nerscProject: process.env.NERSC_PROJECT || 'm1234',
      sendMailUser: process.env.SENDMAIL_USER || 'bilbomd@lbl.gov',
      gitHash: process.env.GIT_HASH || '',
      mode: process.env.BILBOMD_ENV || '',
      workerVersion: workerInfo.version || '',
      workerGitHash: workerInfo.gitHash || '',
    };

    return res.json(configs);
  } catch (error) {
    logger.error('Error fetching worker info or processing request:', error);
    return res.status(500).json({
      message: 'Failed to retrieve configuration information',
      error: error,
    });
  }
};
