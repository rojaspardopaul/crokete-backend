const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

const sendEmail = (body, res, message) => {
  // Debug: Log ALL env vars related to email v2
  console.error("=== EMAIL DEBUG START ===");
  console.error("EMAIL_HOST:", process.env.EMAIL_HOST);
  console.error("HOST:", process.env.HOST);
  console.error("EMAIL_PORT:", process.env.EMAIL_PORT);
  console.error("EMAIL_USER:", process.env.EMAIL_USER ? "SET" : "NOT SET");
  console.error("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
  console.error("=== EMAIL DEBUG END ===");

  // Clean email config values removing ALL whitespace and newlines
  const emailHost = (process.env.EMAIL_HOST || process.env.HOST || 'smtp.gmail.com').replace(/[\r\n\s]+/g, '').trim();
  const emailPort = (process.env.EMAIL_PORT || '465').replace(/[\r\n\s]+/g, '').trim();
  console.error("Using host:", emailHost);
  console.error("Using port:", emailPort);

  const transporter = nodemailer.createTransport({
    host: emailHost,
    // service: process.env.SERVICE, //comment this line if you use custom server/domain
    port: parseInt(emailPort) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },

    //comment out this one if you usi custom server/domain
    // tls: {
    //   rejectUnauthorized: false,
    // },
  });

  transporter.verify((err, success) => {
    if (err) {
      console.error("Verification error:", err);
      res.status(403).send({
        message: `Error during verification: ${err.message}`,
      });
    } else {
      console.log("Server is ready to take our messages");
      transporter.sendMail(body, (err, data) => {
        if (err) {
          console.error("Error sending email:", err);
          res.status(403).send({
            message: `Error sending email: ${err.message}`,
          });
        } else {
          console.log("email sent successfully!");

          res.send({
            message: message,
          });
        }
      });
    }
  });
};
//limit email verification and forget password
const minutes = 30;
const emailVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `You made too many requests. Please try again after ${minutes} minutes.`,
    });
  },
});

const passwordVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `You made too many requests. Please try again after ${minutes} minutes.`,
    });
  },
});

const supportMessageLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `You made too many requests. Please try again after ${minutes} minutes.`,
    });
  },
});

const phoneVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 2,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `You made too many requests. Please try again after ${minutes} minutes.`,
    });
  },
});

module.exports = {
  sendEmail,
  emailVerificationLimit,
  passwordVerificationLimit,
  supportMessageLimit,
  phoneVerificationLimit,
};
