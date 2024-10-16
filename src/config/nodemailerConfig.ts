import { logger } from '../middleware/loggers.js'
import nodemailer from 'nodemailer'
import hbs from 'nodemailer-express-handlebars'

const user = process.env.SEND_EMAIL_USER
const name = process.env.BILBOMD_FQDN

const viewPath = '/app/dist/templates/views/'
const partialsPath = '/app/dist/templates/partials/'

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

// Function to send OTP email using a template
const sendOtpEmail = (email: string, otp: string) => {
  logger.info(`Sending OTP email to ${email} Password is ${otp}`)
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
    subject: 'Your OTP Code',
    template: 'otp',
    context: {
      onetimepasscode: otp
    }
  }

  transporter
    .sendMail(mailOptions)
    .then(() => {
      logger.info(`OTP Email sent to ${email} successfully!`)
    })
    .catch((error) => {
      logger.error(`Error sending OTP email: ${error}`)
    })
}
// Function to send OTP email without using a template
// This function is used for local development
const sendOtpEmailLocal = (email: string, otp: string) => {
  logger.info(`Sending OTP email to ${email} and otp is ${otp}`)

  const mailOptions = {
    from: user,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is: ${otp}`
  }

  transporter
    .sendMail(mailOptions)
    .then(() => {
      logger.info(`OTP Email sent to ${email} successfully!`)
    })
    .catch((error) => {
      logger.error(`Error sending OTP email: ${error}`)
    })
}

export { sendVerificationEmail, sendMagickLinkEmail, sendOtpEmailLocal, sendOtpEmail }
