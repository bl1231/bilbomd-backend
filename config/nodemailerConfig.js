const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const user = process.env.SENDMAIL_USER;
const pass = process.env.SENDMAIL_PASS;
const path = require("path");
const viewPath = path.resolve(__dirname, "../templates/views/");
const partialsPath = path.resolve(__dirname, "../templates/partials");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.gmail.com",
  port: 25,
  secure: false,
});

const sendConfirmationEmail = (email, confirmationCode) => {
  console.log("send email");
  transporter.use(
    "compile",
    hbs({
      viewEngine: {
        extName: ".handlebars",
        layoutsDir: viewPath,
        defaultLayout: false,
        partialsDir: partialsPath,
      },
      viewPath: viewPath,
      extName: ".handlebars",
    })
  );

  const mailOptions = {
    from: user,
    to: email,
    subject: "Sign into BilboMD",
    template: "signup",
    context: {
      confirmationcode: confirmationCode,
    },
  };

  transporter.sendMail(mailOptions).catch((err) => console.log(err));
};

module.exports = sendConfirmationEmail;
