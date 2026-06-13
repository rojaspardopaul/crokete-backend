const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

const sendEmail = (body, res, message) => {
  const emailHost = (process.env.EMAIL_HOST || process.env.HOST || 'smtp.gmail.com').replace(/[\r\n\s]+/g, '').trim();
  const emailPort = (process.env.EMAIL_PORT || '465').replace(/[\r\n\s]+/g, '').trim();

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

  transporter.verify((err) => {
    if (err) {
      console.error("[Email] Verification error:", err.message);
      res.status(403).send({ message: "Error al conectar con el servidor de email." });
    } else {
      transporter.sendMail(body, (sendErr) => {
        if (sendErr) {
          console.error("[Email] Send error:", sendErr.message);
          res.status(403).send({ message: "Error al enviar el email." });
        } else {
          res.send({ message });
        }
      });
    }
  });
};

// Fire-and-forget version — no res object needed
const sendEmailAsync = async (body) => {
  const emailHost = (process.env.EMAIL_HOST || process.env.HOST || 'smtp.gmail.com').replace(/[\r\n\s]+/g, '').trim();
  const emailPort = (process.env.EMAIL_PORT || '465').replace(/[\r\n\s]+/g, '').trim();
  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: parseInt(emailPort) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  await transporter.sendMail(body);
};

//limit email verification and forget password
const minutes = 30;
const emailVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `Has hecho demasiadas solicitudes. Inténtalo de nuevo en ${minutes} minutos.`,
    });
  },
});

const passwordVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `Has hecho demasiadas solicitudes. Inténtalo de nuevo en ${minutes} minutos.`,
    });
  },
});

const supportMessageLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `Has hecho demasiadas solicitudes. Inténtalo de nuevo en ${minutes} minutos.`,
    });
  },
});

const phoneVerificationLimit = rateLimit({
  windowMs: minutes * 60 * 1000,
  max: 2,
  handler: (req, res) => {
    res.status(429).send({
      success: false,
      message: `Has hecho demasiadas solicitudes. Inténtalo de nuevo en ${minutes} minutos.`,
    });
  },
});

module.exports = {
  sendEmail,
  sendEmailAsync,
  emailVerificationLimit,
  passwordVerificationLimit,
  supportMessageLimit,
  phoneVerificationLimit,
};
