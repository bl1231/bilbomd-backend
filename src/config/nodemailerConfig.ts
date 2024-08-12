import { logger } from '../middleware/loggers.js'
import nodemailer from 'nodemailer'
import hbs from 'nodemailer-express-handlebars'
import path from 'path'

const user = process.env.SEND_EMAIL_USER
const name = process.env.BILBOMD_FQDN
const viewPath = path.resolve(__dirname, '../templates/views/')
const partialsPath = path.resolve(__dirname, '../templates/partials')

const transporter = nodemailer.createTransport({
  name: name,
  host: 'smtp-relay.gmail.com',
  port: 25,
  secure: false
})

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
    .catch((error) => {
      logger.error(`Error sending Verification email ${error}`)
    })
}

const sendMagickLinkEmail = (email: string, url: string, otp: string) => {
  logger.info(`Send MagickLink email to ${email}`)
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
      logger.info(`MagickLink Email sent to ${email} successfully!`)
    })
    .catch((error) => {
      logger.error(`Error sending MagickLink email: ${error}`)
    })
}

// const sendJobCompleteEmail = (email: string, url: string, jobid: string) => {
//   logger.info('send job complete email to %s', email)
//   transporter.use(
//     'compile',
//     hbs({
//       viewEngine: {
//         extname: '.handlebars',
//         layoutsDir: viewPath,
//         defaultLayout: false,
//         partialsDir: partialsPath
//       },
//       viewPath: viewPath,
//       extName: '.handlebars'
//     })
//   )

//   const mailOptions = {
//     from: user,
//     to: email,
//     subject: 'BilboMD Job Complete',
//     template: 'jobcomplete',
//     context: {
//       jobid: jobid,
//       url: url
//     }
//   }

//   transporter
//     .sendMail(mailOptions)
//     .then(() => {
//       logger.info('Job Complete Email sent successfully!')
//     })
//     .catch((err) => {
//       logger.error('Error sending Job Complete email:', err)
//     })
// }

export { sendVerificationEmail, sendMagickLinkEmail }
