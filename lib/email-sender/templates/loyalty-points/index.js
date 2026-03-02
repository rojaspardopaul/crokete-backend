const CONFIG = require("../../../../config");

/**
 * Email template for loyalty points earned after order delivery
 * @param {Object} option - { name, email, invoice, pointsEarned, totalPoints, tier, nextMilestone, storeUrl }
 */
const loyaltyPointsEarnedEmail = (option) => {
  const year = new Date().getFullYear();
  const bc = "#3B82F6";
  const bd = "#1E3A5F";
  const bg = "#F1F5F9";
  const tp = "#1E293B";
  const ts = "#64748B";
  const br = "#E2E8F0";
  const ok = "#10B981";
  const gold = "#F59E0B";

  const firstName = option.name ? option.name.split(" ")[0] : "";
  const logo = CONFIG.CLOUDINARY.getImageUrl(CONFIG.CLOUDINARY.IMAGES.LOGO);
  const company = CONFIG.COMPANY.NAME;
  const storeUrl = CONFIG.URLS.STORE;
  const supportEmail = CONFIG.COMPANY.SUPPORT_EMAIL;

  const tierLabels = { nuevo: "Nuevo", frecuente: "Frecuente", vip: "VIP" };
  const tierColors = { nuevo: "#94A3B8", frecuente: bc, vip: gold };
  const tierLabel = tierLabels[option.tier] || "Nuevo";
  const tierColor = tierColors[option.tier] || "#94A3B8";

  let milestoneSection = "";
  if (option.nextMilestone) {
    milestoneSection =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 20px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7ED;border-radius:8px;border-left:4px solid ' +
      gold +
      ';"><tr><td style="padding:16px 20px;">' +
      '<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:' +
      gold +
      ';">🎯 Próximo hito</p>' +
      '<p style="margin:0;font-size:13px;color:' +
      tp +
      ';line-height:1.5;">' +
      option.nextMilestone.label +
      " — Te faltan <strong>" +
      option.nextMilestone.ordersLeft +
      " pedido(s)</strong></p>" +
      "</td></tr></table></td></tr></table>";
  }

  let milestoneUnlocked = "";
  if (option.milestoneReward) {
    milestoneUnlocked =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 20px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ECFDF5;border-radius:8px;border:2px solid ' +
      ok +
      ';"><tr><td style="padding:20px;text-align:center;">' +
      '<p style="margin:0 0 8px;font-size:24px;">🎉</p>' +
      '<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:' +
      ok +
      ';">¡Hito desbloqueado!</p>' +
      '<p style="margin:0 0 12px;font-size:14px;color:' +
      tp +
      ';">' +
      option.milestoneReward.description +
      "</p>" +
      '<div style="display:inline-block;background-color:' +
      ok +
      ';color:#FFF;font-size:16px;font-weight:700;padding:10px 24px;border-radius:8px;letter-spacing:1px;">' +
      option.milestoneReward.couponCode +
      "</div>" +
      '<p style="margin:8px 0 0;font-size:12px;color:' +
      ts +
      ';">Válido por 60 días</p>' +
      "</td></tr></table></td></tr></table>";
  }

  return (
    "<!DOCTYPE html>" +
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>' +
    '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
    "<title>¡Ganaste Puntos! - " +
    company +
    "</title></head>" +
    '<body style="margin:0;padding:0;background-color:' +
    bg +
    ';font-family:Helvetica Neue,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">' +
    '<div style="display:none;max-height:0;overflow:hidden;">¡Ganaste ' +
    option.pointsEarned +
    " puntos con tu pedido #" +
    option.invoice +
    "!</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' +
    bg +
    ';"><tr><td align="center" style="padding:32px 16px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">' +
    // HEADER
    '<tr><td bgcolor="' +
    bd +
    '" style="background-color:' +
    bd +
    ";background:linear-gradient(135deg," +
    bd +
    " 0%," +
    bc +
    ' 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">' +
    '<img src="' +
    logo +
    '" alt="' +
    company +
    '" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;"/>' +
    '<h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">¡Ganaste Puntos! 🐾</h1>' +
    '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Crokete Rewards</p>' +
    "</td></tr>" +
    // BODY
    '<tr><td style="background-color:#FFFFFF;padding:0;">' +
    // Points earned highlight
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:28px 40px;text-align:center;">' +
    '<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:' +
    tp +
    ';">¡Hola ' +
    firstName +
    "!</h2>" +
    '<p style="margin:0 0 20px;font-size:14px;color:' +
    ts +
    ';">Tu pedido #' +
    option.invoice +
    " fue entregado exitosamente.</p>" +
    '<div style="display:inline-block;background-color:' +
    bg +
    ';border-radius:12px;padding:24px 40px;">' +
    '<p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' +
    ts +
    ';">Puntos ganados</p>' +
    '<p style="margin:0;font-size:36px;font-weight:800;color:' +
    bc +
    ';">+' +
    option.pointsEarned +
    "</p>" +
    "</div>" +
    "</td></tr></table>" +
    // Balance + Tier
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' +
    bg +
    ';border-radius:8px;"><tr>' +
    '<td style="padding:16px 20px;width:50%;vertical-align:top;border-right:1px solid ' +
    br +
    ';text-align:center;">' +
    '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' +
    ts +
    ';">Saldo total</p>' +
    '<p style="margin:0;font-size:20px;color:' +
    tp +
    ';font-weight:700;">' +
    option.totalPoints +
    " pts</p></td>" +
    '<td style="padding:16px 20px;width:50%;vertical-align:top;text-align:center;">' +
    '<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' +
    ts +
    ';">Tu nivel</p>' +
    '<span style="display:inline-block;background-color:' +
    tierColor +
    ';color:#FFF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:4px 12px;border-radius:12px;">' +
    tierLabel +
    "</span></td>" +
    "</tr></table></td></tr></table>" +
    // Milestone unlocked (if any)
    milestoneUnlocked +
    // Next milestone
    milestoneSection +
    // CTA
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="padding:8px 40px 28px;text-align:center;">' +
    '<a href="' +
    storeUrl +
    '/user/rewards" style="display:inline-block;background-color:' +
    bc +
    ';color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">Ver Mis Recompensas</a>' +
    "</td></tr></table>" +
    // Help
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 40px 28px;">' +
    '<p style="margin:0;font-size:12px;color:' +
    ts +
    ';text-align:center;line-height:1.5;">¿Dudas? Escríbenos a <a href="mailto:' +
    supportEmail +
    '" style="color:' +
    bc +
    ';text-decoration:none;">' +
    supportEmail +
    "</a></p>" +
    "</td></tr></table>" +
    "</td></tr>" +
    // FOOTER
    '<tr><td style="background-color:' +
    bd +
    ';padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">' +
    '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;">Eres parte de Crokete Rewards.</p>' +
    '<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">&copy; ' +
    year +
    " " +
    company +
    ". Todos los derechos reservados.</p>" +
    "</td></tr>" +
    "</table></td></tr></table></body></html>"
  );
};

module.exports = loyaltyPointsEarnedEmail;
