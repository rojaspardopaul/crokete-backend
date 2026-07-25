const { getPrisma } = require("../prisma");
const { isUuid } = require("../prisma/helpers");

/**
 * El nombre del admin es un objeto ({firstName, lastName, es}) mientras que la
 * bitácora guarda texto plano — es una copia histórica, no una referencia. Sin
 * esta conversión el registro terminaba como "[object Object]".
 */
function toDisplayName(name) {
  if (!name) return "";
  if (typeof name === "string") return name;
  if (typeof name !== "object") return String(name);

  const full = [name.firstName, name.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;

  const localized = name.es || name.en || Object.values(name).find((v) => typeof v === "string");
  return localized || "";
}

/**
 * Log an admin action to the audit trail
 * @param {Object} params - Parameters for logging
 * @param {String} params.adminId - ID of the admin performing the action
 * @param {String} params.adminEmail - Email of the admin performing the action
 * @param {String} params.adminName - Name of the admin performing the action
 * @param {String} params.action - Action being performed (e.g., 'CREATE_ADMIN', 'LOGIN_SUCCESS')
 * @param {String} params.targetId - ID of the target admin (if applicable)
 * @param {String} params.targetEmail - Email of the target admin (if applicable)
 * @param {String} params.targetRole - Role of the target admin (if applicable)
 * @param {Object} params.changes - Object describing what changed (if applicable)
 * @param {String} params.ip - IP address of the request
 * @param {String} params.userAgent - User agent of the request
 * @param {String} params.status - 'success' or 'failure'
 * @param {String} params.errorMessage - Error message if status is 'failure'
 */
const logAction = async ({
  adminId,
  adminEmail,
  adminName,
  action,
  targetId = null,
  targetEmail = null,
  targetRole = null,
  changes = null,
  ip,
  userAgent = null,
  status = "success",
  errorMessage = null,
}) => {
  try {
    // adminId es obligatorio y con clave foránea: un id no válido (por ejemplo
    // un intento de login fallido sin admin real) haría fallar el insert, y la
    // bitácora nunca debe romper el flujo principal.
    if (!isUuid(adminId)) {
      console.warn(`⚠️  Audit Log omitido (adminId no válido): ${action} — ${adminEmail}`);
      return;
    }

    await getPrisma().auditLog.create({
      data: {
        adminId,
        adminEmail,
        adminName: toDisplayName(adminName),
        action,
        targetId: isUuid(targetId) ? targetId : null,
        targetEmail,
        targetRole,
        changes: changes ?? undefined,
        ip,
        userAgent,
        status,
        errorMessage,
      },
    });
    console.log(`📝 Audit Log: ${adminEmail} performed ${action}${targetEmail ? ` on ${targetEmail}` : ''}`);
  } catch (error) {
    console.error("❌ Error logging audit action:", error);
    // Don't throw error - logging should not break the main flow
  }
};

/**
 * Helper to extract IP address from request
 */
const getIpFromRequest = (req) => {
  return req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"] || "unknown";
};

/**
 * Helper to extract user agent from request
 */
const getUserAgentFromRequest = (req) => {
  return req.headers["user-agent"] || null;
};

/**
 * Helper to compare objects and extract changes
 */
const getChanges = (oldObj, newObj) => {
  const changes = {};
  const fields = [...new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])];

  fields.forEach((field) => {
    // Skip certain fields
    if (["password", "_id", "id", "__v", "createdAt", "updatedAt"].includes(field)) {
      return;
    }

    const oldValue = oldObj?.[field];
    const newValue = newObj?.[field];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[field] = {
        old: oldValue,
        new: newValue,
      };
    }
  });

  return Object.keys(changes).length > 0 ? changes : null;
};

module.exports = {
  logAction,
  getIpFromRequest,
  getUserAgentFromRequest,
  getChanges,
};
