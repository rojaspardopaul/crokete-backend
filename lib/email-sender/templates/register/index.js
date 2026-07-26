const CONFIG = require('../../../../config');

const customerRegisterBody = (option) => {
  const year = new Date().getFullYear();
  const bc = '#3B82F6';
  const bd = '#1E3A5F';
  const bg = '#F1F5F9';
  const tp = '#1E293B';
  const ts = '#64748B';
  const br = '#E2E8F0';
  const logo = CONFIG.ASSETS.LOGO;
  const company = CONFIG.COMPANY.NAME;
  const supportEmail = CONFIG.COMPANY.SUPPORT_EMAIL;
  const verifyUrl = CONFIG.URLS.STORE + '/auth/email-verification/' + option.token;
  const firstName = option.name ? option.name.split(' ')[0] : '';

  return '<!DOCTYPE html>'
+ '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>'
+ '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
+ '<title>Verifica tu Correo - ' + company + '</title></head>'
+ '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:Helvetica Neue,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">'

// Hidden preheader
+ '<div style="display:none;max-height:0;overflow:hidden;">Verifica tu correo electrónico para activar tu cuenta en ' + company + '.</div>'

+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';"><tr><td align="center" style="padding:32px 16px;">'
+ '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">'

// HEADER
+ '<tr><td bgcolor="' + bd + '" style="background-color:' + bd + ';background:linear-gradient(135deg,' + bd + ' 0%,' + bc + ' 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">'
+ '<img src="' + logo + '" alt="' + company + '" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;"/>'
+ '<h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Verifica tu Correo Electrónico</h1>'
+ '</td></tr>'

// BODY
+ '<tr><td style="background-color:#FFFFFF;padding:0;">'

// Icon
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:36px 40px 0;text-align:center;">'
+ '<div style="display:inline-block;width:64px;height:64px;border-radius:50%;background-color:' + bg + ';line-height:64px;font-size:28px;">&#9993;</div>'
+ '</td></tr></table>'

// Greeting
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:20px 40px 8px;text-align:center;">'
+ '<h2 style="margin:0;font-size:18px;font-weight:700;color:' + tp + ';">¡Bienvenido' + (firstName ? ' ' + firstName : '') + '!</h2>'
+ '<p style="margin:12px 0 0;font-size:14px;color:' + ts + ';line-height:1.6;">Gracias por registrarte en <strong>' + company + '</strong>. Para completar tu registro y activar tu cuenta, por favor verifica tu correo electrónico haciendo clic en el botón de abajo.</p>'
+ '</td></tr></table>'

// CTA button
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:28px 40px;text-align:center;">'
+ '<a href="' + verifyUrl + '" style="display:inline-block;background-color:' + bc + ';color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Verificar Cuenta</a>'
+ '</td></tr></table>'

// Fallback link
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:0 40px 8px;text-align:center;">'
+ '<p style="margin:0;font-size:12px;color:' + ts + ';line-height:1.5;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>'
+ '<p style="margin:6px 0 0;font-size:12px;color:' + bc + ';word-break:break-all;"><a href="' + verifyUrl + '" style="color:' + bc + ';text-decoration:none;">' + verifyUrl + '</a></p>'
+ '</td></tr></table>'

// Note
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px 28px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;border-left:4px solid #F59E0B;"><tr><td style="padding:16px 20px;">'
+ '<p style="margin:0;font-size:13px;color:' + ts + ';line-height:1.5;">Si no creaste esta cuenta, puedes ignorar este correo de forma segura. Este enlace expirará en 24 horas.</p>'
+ '</td></tr></table></td></tr></table>'

// Help
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 28px;text-align:center;">'
+ '<p style="margin:0;font-size:13px;color:' + ts + ';">¿Necesitas ayuda? <a href="mailto:' + supportEmail + '" style="color:' + bc + ';text-decoration:none;font-weight:600;">' + supportEmail + '</a></p>'
+ '</td></tr></table>'

+ '</td></tr>'

// FOOTER
+ '<tr><td style="background-color:' + bd + ';padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">'
+ '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;">Recibiste este correo porque te registraste en ' + company + '.</p>'
+ '<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">&copy; ' + year + ' ' + company + '. Todos los derechos reservados.</p>'
+ '</td></tr>'

+ '</table></td></tr></table></body></html>';
};

module.exports = { customerRegisterBody };
