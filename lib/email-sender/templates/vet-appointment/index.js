const CONFIG = require("../../../../config");

/**
 * Email template for vet appointment status updates
 * @param {Object} option - { name, email, status, petName, vetName, date, duration, meetingUrl, reason, finalPrice, cancellationReason }
 */
const vetAppointmentEmail = (option) => {
  const year = new Date().getFullYear();
  const bc = "#3B82F6";
  const bg = "#F1F5F9";
  const tp = "#1E293B";
  const ts = "#64748B";
  const ok = "#10B981";
  const warn = "#F59E0B";
  const err = "#EF4444";

  const firstName = option.name ? option.name.split(" ")[0] : "";
  const logo = CONFIG.ASSETS.LOGO;
  const company = CONFIG.COMPANY.NAME;
  const storeUrl = CONFIG.URLS.STORE;
  const supportEmail = CONFIG.COMPANY.SUPPORT_EMAIL;

  const statusConfig = {
    requested: {
      title: "Solicitud de Consulta Recibida",
      icon: "📋",
      color: bc,
      message:
        "Hemos recibido tu solicitud de consulta veterinaria. Nuestro equipo la revisará y te notificaremos cuando sea aprobada.",
    },
    approved: {
      title: "¡Consulta Aprobada!",
      icon: "✅",
      color: ok,
      message:
        "Tu consulta veterinaria ha sido aprobada. A continuación encontrarás los detalles y el enlace para conectarte.",
    },
    rejected: {
      title: "Consulta No Disponible",
      icon: "❌",
      color: err,
      message:
        "Lamentamos informarte que tu solicitud de consulta no pudo ser aprobada en este momento. Por favor, intenta con otro horario o contacta a nuestro equipo.",
    },
    cancelled: {
      title: "Consulta Cancelada",
      icon: "🚫",
      color: ts,
      message: "Tu consulta veterinaria ha sido cancelada.",
    },
    confirmed: {
      title: "Consulta Confirmada",
      icon: "🎯",
      color: ok,
      message:
        "Tu consulta veterinaria está confirmada. ¡Te esperamos!",
    },
    completed: {
      title: "Consulta Completada",
      icon: "🐾",
      color: ok,
      message:
        "Tu consulta veterinaria ha sido completada. Esperamos que haya sido de ayuda para tu mascota.",
    },
  };

  const sc = statusConfig[option.status] || statusConfig.requested;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper: builds a single detail row (stacked for mobile: label on top, value below)
  const detailRow = (icon, label, value) => {
    return (
      '<tr><td style="padding:8px 0 2px;font-size:13px;color:' + ts + ';font-weight:600;">' +
      icon + ' ' + label +
      '</td></tr>' +
      '<tr><td style="padding:0 0 10px;font-size:15px;color:' + tp + ';">' +
      value +
      '</td></tr>'
    );
  };

  let meetingSection = "";
  if (option.meetingUrl && ["approved", "confirmed"].includes(option.status)) {
    meetingSection =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 10px 12px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ECFDF5;border-radius:8px;border:2px solid ' +
      ok +
      ';"><tr><td style="padding:14px;text-align:center;">' +
      '<p style="margin:0 0 6px;font-size:24px;">📹</p>' +
      '<p style="margin:0 0 4px;font-size:15px;font-weight:700;color:' +
      ok +
      ';">Enlace de Videollamada</p>' +
      '<p style="margin:0 0 12px;font-size:13px;color:' +
      ts +
      ';">Ingresa al siguiente enlace al momento de tu cita</p>' +
      '<a href="' +
      option.meetingUrl +
      '" style="display:inline-block;background-color:' +
      ok +
      ';color:#FFF;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">Unirse a la Consulta</a>' +
      "</td></tr></table></td></tr></table>";
  }

  let priceRow = "";
  if (option.finalPrice !== undefined && option.status === "approved") {
    const priceValue = option.finalPrice === 0
      ? '<span style="color:' + ok + ';font-weight:700;">¡GRATIS!</span>'
      : "$" + option.finalPrice.toFixed(2) + " MXN";
    priceRow = detailRow("💰", "Precio", priceValue);
  }

  // Cancellation/rejection reason section
  let reasonSection = "";
  if (option.cancellationReason && ["cancelled", "rejected"].includes(option.status)) {
    const reasonColor = option.status === "rejected" ? err : ts;
    const reasonBg = option.status === "rejected" ? "#FEF2F2" : "#F8FAFC";
    const reasonBorder = option.status === "rejected" ? err : "#CBD5E1";
    const reasonLabel = option.status === "rejected" ? "Motivo del rechazo" : "Motivo de la cancelación";
    reasonSection =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 10px 12px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + reasonBg + ';border-radius:8px;border-left:4px solid ' + reasonBorder + ';">' +
      '<tr><td style="padding:14px 16px;">' +
      '<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:' + reasonColor + ';">' +
      (option.status === "rejected" ? "⚠️" : "💬") + ' ' + reasonLabel + '</p>' +
      '<p style="margin:0;font-size:14px;color:' + tp + ';line-height:1.5;">' +
      option.cancellationReason +
      '</p></td></tr></table></td></tr></table>';
  }

  return (
    "<!DOCTYPE html>" +
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>' +
    '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
    "<title>" +
    sc.title +
    " - " +
    company +
    "</title></head>" +
    '<body style="margin:0;padding:0;background-color:' +
    bg +
    ";font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:12px 4px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">' +
    // Header
    "<tr><td>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' +
    sc.color +
    ';border-radius:12px 12px 0 0;"><tr><td style="padding:20px 10px;text-align:center;">' +
    '<img src="' +
    logo +
    '" alt="' +
    company +
    '" width="100" style="display:block;margin:0 auto 10px;"/>' +
    '<p style="margin:0;font-size:28px;">' +
    sc.icon +
    "</p>" +
    '<h1 style="margin:8px 0 0;font-size:18px;font-weight:700;color:#FFF;">' +
    sc.title +
    "</h1>" +
    "</td></tr></table></td></tr>" +
    // Body
    "<tr><td>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF;"><tr><td style="padding:20px 10px;">' +
    '<p style="margin:0 0 12px;font-size:16px;color:' +
    tp +
    ';">Hola <strong>' +
    firstName +
    "</strong>,</p>" +
    '<p style="margin:0 0 20px;font-size:14px;color:' +
    ts +
    ';line-height:1.6;">' +
    sc.message +
    "</p>" +
    // Details card — single-column stacked layout (mobile-friendly)
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' +
    bg +
    ';border-radius:8px;"><tr><td style="padding:10px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    detailRow("🐾", "Mascota", option.petName || "") +
    detailRow("👨‍⚕️", "Veterinario", option.vetName || "") +
    detailRow("📅", "Fecha", formatDate(option.date)) +
    detailRow("⏱️", "Duración", (option.duration || "") + " min") +
    detailRow("📝", "Motivo de consulta", option.reason || "") +
    priceRow +
    "</table></td></tr></table>" +
    "</td></tr></table></td></tr>" +
    // Cancellation/rejection reason section
    reasonSection +
    // Meeting URL section
    meetingSection +
    // Footer
    "<tr><td>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF;border-radius:0 0 12px 12px;"><tr><td style="padding:14px 10px 20px;text-align:center;border-top:1px solid #E2E8F0;">' +
    '<p style="margin:0 0 8px;font-size:12px;color:' +
    ts +
    ';">¿Tienes preguntas? Escríbenos a <a href="mailto:' +
    supportEmail +
    '" style="color:' +
    bc +
    ';">' +
    supportEmail +
    "</a></p>" +
    '<p style="margin:0;font-size:11px;color:#CBD5E1;">© ' +
    year +
    " " +
    company +
    ". Todos los derechos reservados.</p>" +
    "</td></tr></table></td></tr>" +
    "</table></td></tr></table></body></html>"
  );
};

module.exports = vetAppointmentEmail;
