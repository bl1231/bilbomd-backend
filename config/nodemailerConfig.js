const nodemailer = require('nodemailer')
const hbs = require('nodemailer-express-handlebars')
const user = process.env.SENDMAIL_USER
//const pass = process.env.SENDMAIL_PASS;
const path = require('path')
const viewPath = path.resolve(__dirname, '../templates/views/')
const partialsPath = path.resolve(__dirname, '../templates/partials')

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.gmail.com',
  port: 25,
  secure: false
})

const sendVerificationEmail = (email, url, code) => {
  console.log('send verification email')
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

  transporter.sendMail(mailOptions).catch((err) => console.log(err))
}

const sendMagickLinkEmail = (email, url, otp) => {
  console.log('send magicklink email')
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

  transporter.sendMail(mailOptions).catch((err) => console.log(err))
}

const sendJobCompleteEmail = (email, url, jobid) => {
  console.log('send job complete email')
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

  transporter.sendMail(mailOptions).catch((err) => console.log(err))
}

module.exports = { sendVerificationEmail, sendMagickLinkEmail, sendJobCompleteEmail }
