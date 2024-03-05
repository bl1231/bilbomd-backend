import { logger } from '../middleware/loggers'
import nodemailer from 'nodemailer'
import hbs from 'nodemailer-express-handlebars'
import path from 'path'

const user = process.env.SENDMAIL_USER
const viewPath = path.resolve(__dirname, '../templates/views/')
const partialsPath = path.resolve(__dirname, '../templates/partials')

const transporter = nodemailer.createTransport({
  name: 'bilbomd.bl1231.als.lbl.gov',
  host: 'smtp-relay.gmail.com',
  port: 25,
  secure: false
})
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     type: 'OAuth2',
//     user: 'bilbomd@lbl.gov',
//     clientId: 'CLIENTID',
//     clientSecret: 'SECRET',
//     refreshToken: ''
//   }
// })
const sendVerificationEmail = (email: string, url: string, code: string) => {
  logger.info(`send verification email to ${email}`)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extname: '.handlebars',
        layoutsDir: viewPath,
        defaultLayout: false,
        partialsDir: partialsPath
      },
      viewPath: viewPath,
      extName: '.handlebars'
    })
  )

  const mailOptions = {
    from: user,
    to: email,
    subject: 'Verify BilboMD email',
    template: 'signup',
    context: {
      confirmationcode: code,
      url: url
    }
  }

  transporter
    .sendMail(mailOptions)
    .then(() => {
      logger.info('Verification Email sent successfully!')
    })
    .catch((err) => {
      logger.error('Error sending Verification email:', err)
    })
}

const sendMagickLinkEmail = (email: string, url: string, otp: string) => {
  logger.info('send magicklink email to %s', email)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extname: '.handlebars',
        layoutsDir: viewPath,
        defaultLayout: false,
        partialsDir: partialsPath
      },
      viewPath: viewPath,
      extName: '.handlebars'
    })
  )

  const mailOptions = {
    from: user,
    to: email,
    subject: 'BilboMD MagickLink',
    template: 'magicklink',
    context: {
      onetimepasscode: otp,
      url: url
    }
  }

  transporter
    .sendMail(mailOptions)
    .then(() => {
      logger.info('MagickLink Email sent to %s successfully!', email)
    })
    .catch((err) => {
      logger.error('Error sending MagickLink email: %s', err)
    })
}

const sendJobCompleteEmail = (email: string, url: string, jobid: string) => {
  logger.info('send job complete email to %s', email)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extname: '.handlebars',
        layoutsDir: viewPath,
        defaultLayout: false,
        partialsDir: partialsPath
      },
      viewPath: viewPath,
      extName: '.handlebars'
    })
  )

  const mailOptions = {
    from: user,
    to: email,
    subject: 'BilboMD Job Complete',
    template: 'jobcomplete',
    context: {
      jobid: jobid,
      url: url
    }
  }

  transporter
    .sendMail(mailOptions)
    .then(() => {
      logger.info('Job Complete Email sent successfully!')
    })
    .catch((err) => {
      logger.error('Error sending Job Complete email:', err)
    })
}

export { sendVerificationEmail, sendMagickLinkEmail, sendJobCompleteEmail }
