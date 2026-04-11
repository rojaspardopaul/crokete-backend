const { sendEmail } = require("../lib/email-sender/sender");
const CONFIG = require("../config");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildContactEmailHtml = ({ name, email, subject, message }) => {
  const bc = "#f97316"; // kachabazar-500 orange
  const year = new Date().getFullYear();
  const company = CONFIG.COMPANY.NAME;
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return (
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuevo mensaje de contacto</title></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 20px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">` +
    `<tr><td style="background-color:${bc};padding:32px 40px;text-align:center;">` +
    `<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${company}</h1>` +
    `<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Nuevo mensaje desde el formulario de contacto</p>` +
    `</td></tr>` +
    `<tr><td style="padding:32px 40px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border-left:4px solid ${bc};margin-bottom:24px;">` +
    `<tr><td style="padding:16px 20px;">` +
    `<p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">De</p>` +
    `<p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(name)}</p>` +
    `<p style="margin:4px 0 0;font-size:14px;color:${bc};"><a href="mailto:${escapeHtml(email)}" style="color:${bc};text-decoration:none;">${escapeHtml(email)}</a></p>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Asunto</p>` +
    `<p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(subject)}</p>` +
    `<p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Mensaje</p>` +
    `<div style="background:#f9fafb;border-radius:8px;padding:16px 20px;font-size:14px;color:#374151;line-height:1.7;">${escapedMessage}</div>` +
    `</td></tr>` +
    `<tr><td style="background-color:#1f2937;padding:24px 40px;border-radius:0 0 12px 12px;text-align:center;">` +
    `<p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">Responde directamente a este correo para contestar al cliente.</p>` +
    `<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">&copy; ${year} ${company}. Todos los derechos reservados.</p>` +
    `</td></tr></table>` +
    `</td></tr></table></body></html>`
  );
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const sendContactEmail = async (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return res.status(400).json({ message: "Todos los campos son requeridos." });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "El correo electrónico no es válido." });
  }

  if (message.length > 2000) {
    return res.status(400).json({ message: "El mensaje no puede superar los 2000 caracteres." });
  }

  const body = {
    from: CONFIG.EMAIL.FROM,
    to: CONFIG.COMPANY.EMAIL,
    replyTo: email.trim(),
    subject: `[Contacto Web] ${subject.trim()}`,
    html: buildContactEmailHtml({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    }),
  };

  sendEmail(body, res, "Tu mensaje ha sido enviado correctamente. Nos pondremos en contacto contigo pronto.");
};

module.exports = { sendContactEmail };
