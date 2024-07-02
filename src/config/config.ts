// config.ts or a similar file
import dotenv from 'dotenv'
dotenv.config()

export const config = {
  sendEmailNotifications: process.env.SEND_EMAIL_NOTIFICATIONS === 'true',
  runOnNERSC: process.env.USE_NERSC === 'true',
  bullmqAttempts: process.env.BULLMQ_ATTEMPTS ? parseInt(process.env.BULLMQ_ATTEMPTS) : 3
}
