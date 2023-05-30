const { logger } = require('../middleware/loggers')
const nodemailer = require('nodemailer')
const hbs = require('nodemailer-express-handlebars')
const user = process.env.SENDMAIL_USER
//const pass = process.env.SENDMAIL_PASS;
const path = require('path')
const viewPath = path.resolve(__dirname, '../templates/views/')
const partialsPath = path.resolve(__dirname, '../templates/partials')

const transporter = nodemailer.createTransport({
  name: 'bl1231-local.als.lbl.gov',
  host: 'smtp-relay.gmail.com',
  port: 25,
  secure: false
})

const sendVerificationEmail = (email, url, code) => {
  logger.info('send verification email to %s', email)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extName: '.handlebars',
        defaultLayout: false,
        layoutsDir: viewPath,
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

const sendMagickLinkEmail = (email, url, otp) => {
  logger.info('send magicklink email to %s', email)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extName: '.handlebars',
        defaultLayout: false,
        layoutsDir: viewPath,
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

const sendJobCompleteEmail = (email, url, jobid) => {
  logger.info('send job complete email to %s', email)
  transporter.use(
    'compile',
    hbs({
      viewEngine: {
        extName: '.handlebars',
        defaultLayout: false,
        layoutsDir: viewPath,
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

module.exports = { sendVerificationEmail, sendMagickLinkEmail, sendJobCompleteEmail }
