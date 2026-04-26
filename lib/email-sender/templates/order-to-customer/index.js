const CONFIG = require('../../../../config');

const customerInvoiceEmailBody = (option) => {
  const year = new Date().getFullYear();
  const bc = '#3B82F6';
  const bd = '#1E3A5F';
  const bg = '#F1F5F9';
  const tp = '#1E293B';
  const ts = '#64748B';
  const br = '#E2E8F0';
  const ok = '#10B981';
  const ac = '#0EA5E9';
  const sc = { Pending:'#F59E0B', Processing:'#3B82F6', Shipped:'#8B5CF6', Delivered:'#10B981', Cancel:'#EF4444', pedido:'#F59E0B', empaquetado:'#3B82F6', en_reparto:'#8B5CF6', entregado:'#10B981', cancelado:'#EF4444' };
  const statusColor = sc[option.status] || bc;
  const statusMap = { Pending:'Pedido', Processing:'Empaquetado', Shipped:'En Reparto', Delivered:'Entregado', Cancel:'Cancelado', pedido:'Pedido', empaquetado:'Empaquetado', en_reparto:'En Reparto', entregado:'Entregado', cancelado:'Cancelado' };
  const statusText = statusMap[option.status] || option.status;
  const methodMap = { Cash:'Contra Entrega', Card:'Tarjeta de Crédito' };
  const methodText = methodMap[option.method] || option.method;
  const firstName = option.name ? option.name.split(' ')[0] : '';
  const logo = CONFIG.CLOUDINARY.getImageUrl(CONFIG.CLOUDINARY.IMAGES.LOGO);
  const supportEmail = CONFIG.COMPANY.SUPPORT_EMAIL;
  const phone = CONFIG.COMPANY.PHONE || '';
  const company = CONFIG.COMPANY.NAME;
  const storeUrl = CONFIG.URLS.STORE;
  const cur = option.currency;

  const cartRows = option.cart.map(function(item) {
    var title = item.title.length > 40 ? item.title.substring(0, 40) + '…' : item.title;
    return '<tr style="border-bottom:1px solid ' + br + ';">'
      + '<td style="padding:14px 16px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + tp + ';line-height:1.4;">' + title + '</td>'
      + '<td style="padding:14px 16px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + tp + ';text-align:center;">' + item.quantity + '</td>'
      + '<td style="padding:14px 16px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + tp + ';text-align:right;">' + cur + Number(item.originalPrice || item.price).toFixed(2) + '</td>'
      + '<td style="padding:14px 16px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + ((item.originalPrice || item.price) * item.quantity).toFixed(2) + '</td>'
      + '</tr>';
  }).join('');

  var discountRow = '';
  if (option.discount > 0) {
    discountRow = '<tr>'
      + '<td style="padding:6px 0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + ok + ';">Descuento</td>'
      + '<td style="padding:6px 0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;color:' + ok + ';text-align:right;font-weight:600;">-' + cur + option.discount.toFixed(2) + '</td>'
      + '</tr>';
  }

  var ivaRow = '';
  if ((option.taxRate || 0) > 0 && (option.taxAmount || 0) > 0) {
    ivaRow = '<tr>'
      + '<td style="padding:6px 0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;color:' + ts + ';">IVA (' + option.taxRate + '%) incluido</td>'
      + '<td style="padding:6px 0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;color:' + ts + ';text-align:right;">' + cur + (option.taxAmount).toFixed(2) + '</td>'
      + '</tr>';
  }

  return '<!DOCTYPE html>'
+ '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>'
+ '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
+ '<title>Tu Pedido - ' + company + '</title></head>'
+ '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:Helvetica Neue,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">'

// Hidden preheader
+ '<div style="display:none;max-height:0;overflow:hidden;">Tu pedido #' + option.invoice + ' ha sido recibido. Gracias por tu compra en ' + company + '.</div>'

+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';"><tr><td align="center" style="padding:32px 16px;">'
+ '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">'

// HEADER
+ '<tr><td bgcolor="' + bd + '" style="background-color:' + bd + ';background:linear-gradient(135deg,' + bd + ' 0%,' + bc + ' 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">'
+ '<img src="' + logo + '" alt="' + company + '" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;"/>'
+ '<h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Confirmación de Pedido</h1>'
+ '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Pedido #' + option.invoice + '</p>'
+ '</td></tr>'

// BODY
+ '<tr><td style="background-color:#FFFFFF;padding:0;">'

// Status badge
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:28px 40px 0;text-align:center;">'
+ '<span style="display:inline-block;background-color:' + statusColor + ';color:#FFF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:6px 16px;border-radius:20px;">' + statusText + '</span>'
+ '</td></tr></table>'

// Greeting
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:24px 40px 8px;">'
+ '<h2 style="margin:0;font-size:18px;font-weight:700;color:' + tp + ';">¡Hola' + (firstName ? ' ' + firstName : '') + '!</h2>'
+ '<p style="margin:8px 0 0;font-size:14px;color:' + ts + ';line-height:1.6;">Gracias por tu compra. Hemos recibido tu pedido y lo estamos procesando. A continuación encontrarás los detalles de tu orden.</p>'
+ '</td></tr></table>'

// Order info grid
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;"><tr>'
+ '<td style="padding:16px 20px;width:50%;vertical-align:top;border-right:1px solid ' + br + ';">'
+ '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Fecha</p>'
+ '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">' + option.date + '</p></td>'
+ '<td style="padding:16px 20px;width:50%;vertical-align:top;">'
+ '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Método de Pago</p>'
+ '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">' + methodText + '</p></td>'
+ '</tr></table></td></tr></table>'

// Shipping info
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 20px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;"><tr><td style="padding:16px 20px;">'
+ '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Enviar a</p>'
+ '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">' + (option.name || '') + '</p>'
+ '<p style="margin:2px 0 0;font-size:13px;color:' + ts + ';line-height:1.5;">'
+ (option.email ? option.email + '<br/>' : '') + (option.phone ? option.phone + '<br/>' : '') + (option.address || '')
+ '</p></td></tr></table></td></tr></table>'

// Divider
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px;"><div style="border-top:1px solid ' + br + ';"></div></td></tr></table>'

// Section header
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:24px 40px 12px;">'
+ '<h3 style="margin:0;font-size:15px;font-weight:700;color:' + tp + ';text-transform:uppercase;letter-spacing:0.5px;">Detalle del Pedido</h3>'
+ '</td></tr></table>'

// Cart table
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + br + ';border-radius:8px;overflow:hidden;">'
+ '<thead><tr style="background-color:' + bg + ';">'
+ '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Producto</th>'
+ '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Cant.</th>'
+ '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Precio</th>'
+ '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Total</th>'
+ '</tr></thead><tbody>' + cartRows + '</tbody></table>'
+ '</td></tr></table>'

// Totals
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px 0;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
+ '<tr><td style="padding:6px 0;font-size:14px;color:' + ts + ';">Subtotal</td>'
+ '<td style="padding:6px 0;font-size:14px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + option.subTotal.toFixed(2) + '</td></tr>'
+ '<tr><td style="padding:6px 0;font-size:14px;color:' + ts + ';">Envío</td>'
+ '<td style="padding:6px 0;font-size:14px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + option.shipping.toFixed(2) + '</td></tr>'
+ discountRow
+ ivaRow
+ '<tr><td colspan="2" style="padding:12px 0 0;"><div style="border-top:2px solid ' + br + ';"></div></td></tr>'
+ '<tr><td style="padding:12px 0;font-size:18px;font-weight:800;color:' + tp + ';">Total</td>'
+ '<td style="padding:12px 0;font-size:18px;font-weight:800;color:' + bc + ';text-align:right;">' + cur + option.total.toFixed(2) + '</td></tr>'
+ '</table></td></tr></table>'

// CTA button
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:28px 40px;text-align:center;">'
+ '<a href="' + storeUrl + '" style="display:inline-block;background-color:' + bc + ';color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">Ver Mi Pedido</a>'
+ '</td></tr></table>'

// Help note
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 28px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;border-left:4px solid ' + ac + ';"><tr><td style="padding:16px 20px;">'
+ '<p style="margin:0;font-size:13px;color:' + ts + ';line-height:1.5;">¿Tienes alguna duda sobre tu pedido? Contáctanos en '
+ '<a href="mailto:' + supportEmail + '" style="color:' + bc + ';text-decoration:none;font-weight:600;">' + supportEmail + '</a>'
+ (phone ? ' o al <strong>' + phone + '</strong>' : '')
+ '</p></td></tr></table></td></tr></table>'

// End body
+ '</td></tr>'

// FOOTER
+ '<tr><td style="background-color:' + bd + ';padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">'
+ '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;">Recibiste este correo porque realizaste una compra en ' + company + '.</p>'
+ '<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">&copy; ' + year + ' ' + company + '. Todos los derechos reservados.</p>'
+ '</td></tr>'

+ '</table></td></tr></table></body></html>';
};

module.exports = customerInvoiceEmailBody;
