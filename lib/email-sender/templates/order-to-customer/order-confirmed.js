const CONFIG = require('../../../../config');

/**
 * Amazon-style order confirmation email.
 * Sent automatically when a customer places a new order.
 *
 * option fields:
 *   invoice, name, email, phone, address,
 *   cart (array of { title, quantity, price }),
 *   subTotal, shipping, discount, total,
 *   method, currency
 */
const orderConfirmedEmailBody = (option) => {
  const year = new Date().getFullYear();

  // ─── Color palette (matches existing templates) ───────────────────────────
  const bc = '#3B82F6';   // primary blue
  const bd = '#1E3A5F';   // dark navy (header/footer)
  const bg = '#F1F5F9';   // light gray background
  const tp = '#1E293B';   // text primary
  const ts = '#64748B';   // text secondary
  const br = '#E2E8F0';   // border
  const ok = '#10B981';   // green (success / active step)
  const ac = '#0EA5E9';   // accent cyan
  const logo    = CONFIG.CLOUDINARY.getImageUrl(CONFIG.CLOUDINARY.IMAGES.LOGO);
  const company = CONFIG.COMPANY.NAME;
  const supportEmail = CONFIG.COMPANY.SUPPORT_EMAIL;
  const phone   = CONFIG.COMPANY.PHONE || '';
  const storeUrl = CONFIG.URLS.STORE;
  const cur     = option.currency || '$';
  const firstName = option.name ? option.name.split(' ')[0] : '';

  const methodMap = { Cash: 'Contra Entrega', Card: 'Tarjeta de Crédito', card: 'Tarjeta de Crédito', cash: 'Contra Entrega' };
  const methodText = methodMap[option.method] || option.method || '';

  // ─── Status tracker (4 steps, first always active on new order) ───────────
  const steps = [
    { label: 'Pedido',       active: true  },
    { label: 'Empaquetado',  active: false },
    { label: 'En<br/>Reparto', active: false },
    { label: 'Entregado',    active: false },
  ];

  const stepCell = (step, index, isLast) => {
    // line-height centering is the most email-client-compatible technique
    const circle = step.active
      ? '<div style="width:40px;height:40px;border-radius:50%;background-color:' + ok + ';margin:0 auto 8px;text-align:center;line-height:40px;font-size:20px;color:#fff;font-weight:700;">&#10003;</div>'
      : '<div style="width:40px;height:40px;border-radius:50%;background-color:#E2E8F0;border:2px solid #CBD5E1;margin:0 auto 8px;text-align:center;line-height:36px;font-size:13px;color:#94A3B8;font-weight:600;">' + (index + 1) + '</div>';
    const labelColor = step.active ? ok : '#94A3B8';
    const connector  = isLast ? '' : '<td style="padding:0 6px;vertical-align:middle;padding-bottom:28px;"><span style="font-size:18px;color:#CBD5E1;line-height:1;font-weight:300;">&#8250;</span></td>';
    return '<td style="padding:0;text-align:center;vertical-align:top;min-width:56px;">'
      + circle
      + '<p style="margin:0;font-size:11px;font-weight:' + (step.active ? '700' : '500') + ';color:' + labelColor + ';line-height:1.4;">' + step.label + '</p>'
      + '</td>'
      + connector;
  };

  const trackerCells = steps.map((s, i) => stepCell(s, i, i === steps.length - 1)).join('');

  // ─── Cart rows ──────────────────────────────────────────────────────────
  const cartRows = (option.cart || []).map(function (item) {
    var rawTitle = (typeof item.title === 'object' ? (item.title.es || item.title.en || Object.values(item.title)[0]) : item.title) || '';
    var title = rawTitle.length > 50 ? rawTitle.substring(0, 50) + '…' : rawTitle;
    var qty   = item.quantity || 1;
    var price = Number(item.price) || 0;
    var rowTotal = (price * qty).toFixed(2);
    return '<tr style="border-bottom:1px solid ' + br + ';">'
      + '<td style="padding:14px 16px;font-size:13px;color:' + tp + ';line-height:1.4;">' + title + '</td>'
      + '<td style="padding:14px 16px;font-size:13px;color:' + tp + ';text-align:center;">' + qty + '</td>'
      + '<td style="padding:14px 16px;font-size:13px;color:' + tp + ';text-align:right;">' + cur + price.toFixed(2) + '</td>'
      + '<td style="padding:14px 16px;font-size:13px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + rowTotal + '</td>'
      + '</tr>';
  }).join('');

  // ─── Discount row ────────────────────────────────────────────────────────
  var discountRow = '';
  if (Number(option.discount) > 0) {
    discountRow = '<tr>'
      + '<td style="padding:6px 0;font-size:13px;color:' + ok + ';">Descuento</td>'
      + '<td style="padding:6px 0;font-size:13px;color:' + ok + ';text-align:right;font-weight:600;">-' + cur + Number(option.discount).toFixed(2) + '</td>'
      + '</tr>';
  }

  // ─── Compose email ───────────────────────────────────────────────────────
  return '<!DOCTYPE html>'
    + '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>'
    + '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
    + '<title>Pedido Confirmado #' + option.invoice + ' - ' + company + '</title></head>'
    + '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:Helvetica Neue,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">'

    // Hidden preheader
    + '<div style="display:none;max-height:0;overflow:hidden;">¡Tu pedido #' + option.invoice + ' fue recibido! Lo estamos preparando con cuidado. 🐾</div>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';"><tr><td align="center" style="padding:32px 16px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">'

    // ── HEADER ──
    + '<tr><td bgcolor="' + bd + '" style="background-color:' + bd + ';background:linear-gradient(135deg,' + bd + ' 0%,' + bc + ' 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<img src="' + logo + '" alt="' + company + '" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;"/>'
    + '<h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">¡Pedido Confirmado!</h1>'
    + '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Pedido #' + option.invoice + '</p>'
    + '</td></tr>'

    // ── BODY ──
    + '<tr><td style="background-color:#FFFFFF;padding:0;">'

    // Greeting
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="padding:28px 40px 16px;">'
    + '<h2 style="margin:0;font-size:20px;font-weight:700;color:' + tp + ';">¡Gracias por su compra' + (firstName ? ', ' + firstName : '') + '!</h2>'
    + '<p style="margin:10px 0 0;font-size:14px;color:' + ts + ';line-height:1.6;">Hemos recibido y confirmado tu pedido. Te notificaremos cuando esté en camino.</p>'
    + '</td></tr></table>'

    // ── STATUS TRACKER ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="padding:8px 24px 28px;">'
    + '<div style="background-color:' + bg + ';border-radius:12px;padding:20px 16px;">'
    + '<p style="margin:0 0 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:' + ts + ';text-align:center;">Estado del Pedido</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + trackerCells
    + '</tr></table>'
    + '</div>'
    + '</td></tr></table>'

    // ── DIVIDER ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px;"><div style="border-top:1px solid ' + br + ';"></div></td></tr></table>'

    // ── ORDER INFO GRID (date + payment method) ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;"><tr>'
    + '<td style="padding:16px 20px;width:50%;vertical-align:top;border-right:1px solid ' + br + ';">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Número de Pedido</p>'
    + '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">#' + option.invoice + '</p></td>'
    + '<td style="padding:16px 20px;width:50%;vertical-align:top;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Método de Pago</p>'
    + '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">' + methodText + '</p></td>'
    + '</tr></table></td></tr></table>'

    // ── SHIPPING INFO ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 20px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;"><tr><td style="padding:16px 20px;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + ts + ';">Datos de Entrega</p>'
    + '<p style="margin:0;font-size:14px;color:' + tp + ';font-weight:600;">' + (option.name || '') + '</p>'
    + '<p style="margin:2px 0 0;font-size:13px;color:' + ts + ';line-height:1.5;">'
    + (option.email ? option.email + '<br/>' : '')
    + (option.phone ? option.phone + '<br/>' : '')
    + (option.address || '')
    + '</p></td></tr></table></td></tr></table>'

    // ── DIVIDER ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px;"><div style="border-top:1px solid ' + br + ';"></div></td></tr></table>'

    // ── PRODUCTS SECTION HEADER ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="padding:24px 40px 12px;">'
    + '<h3 style="margin:0;font-size:14px;font-weight:700;color:' + tp + ';text-transform:uppercase;letter-spacing:0.5px;">Productos</h3>'
    + '</td></tr></table>'

    // ── CART TABLE ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + br + ';border-radius:8px;overflow:hidden;">'
    + '<thead><tr style="background-color:' + bg + ';">'
    + '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Producto</th>'
    + '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Cant.</th>'
    + '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Precio</th>'
    + '<th style="padding:12px 16px;font-size:11px;font-weight:700;color:' + ts + ';text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Total</th>'
    + '</tr></thead><tbody>' + cartRows + '</tbody></table>'
    + '</td></tr></table>'

    // ── TOTALS ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px 0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:6px 0;font-size:14px;color:' + ts + ';">Subtotal</td>'
    + '<td style="padding:6px 0;font-size:14px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + Number(option.subTotal || 0).toFixed(2) + '</td></tr>'
    + '<tr><td style="padding:6px 0;font-size:14px;color:' + ts + ';">Envío</td>'
    + '<td style="padding:6px 0;font-size:14px;color:' + tp + ';text-align:right;font-weight:600;">' + cur + Number(option.shipping || 0).toFixed(2) + '</td></tr>'
    + discountRow
    + '<tr><td colspan="2" style="padding:12px 0 0;"><div style="border-top:2px solid ' + br + ';"></div></td></tr>'
    + '<tr><td style="padding:12px 0;font-size:18px;font-weight:800;color:' + tp + ';">Total</td>'
    + '<td style="padding:12px 0;font-size:18px;font-weight:800;color:' + bc + ';text-align:right;">' + cur + Number(option.total || 0).toFixed(2) + '</td></tr>'
    + '</table></td></tr></table>'

    // ── CTA BUTTON ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="padding:28px 40px;text-align:center;">'
    + '<a href="' + storeUrl + '/user/dashboard" style="display:inline-block;background-color:' + bc + ';color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Ver Mi Pedido</a>'
    + '</td></tr></table>'

    // ── HELP NOTE ──
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 28px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;border-left:4px solid ' + ac + ';"><tr><td style="padding:16px 20px;">'
    + '<p style="margin:0;font-size:13px;color:' + ts + ';line-height:1.5;">¿Tienes alguna duda sobre tu pedido? Contáctanos en '
    + '<a href="mailto:' + supportEmail + '" style="color:' + bc + ';text-decoration:none;font-weight:600;">' + supportEmail + '</a>'
    + (phone ? ' o al <strong>' + phone + '</strong>' : '')
    + '</p></td></tr></table></td></tr></table>'

    // End body
    + '</td></tr>'

    // ── FOOTER ──
    + '<tr><td style="background-color:' + bd + ';padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">'
    + '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;">Recibiste este correo porque realizaste una compra en ' + company + '.</p>'
    + '<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">&copy; ' + year + ' ' + company + '. Todos los derechos reservados.</p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
};

module.exports = orderConfirmedEmailBody;
