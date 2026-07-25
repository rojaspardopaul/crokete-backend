const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, fail } = require("../lib/prisma/helpers");

const auditLogs = () => getPrisma().auditLog;

/** Relaciones que antes se traían con populate("adminId"/"targetId"). */
const WITH_ACTORS = {
  admin: { select: { id: true, name: true, email: true } },
  target: { select: { id: true, name: true, email: true } },
};

/**
 * La API heredada devolvía `adminId`/`targetId` ya poblados con el documento
 * del administrador; se reconstruye esa forma desde las relaciones.
 */
function logToApi(row) {
  const { admin, target, ...rest } = row;
  return {
    ...toApi(rest),
    adminId: admin ? toApi(admin) : rest.adminId,
    targetId: target ? toApi(target) : rest.targetId,
  };
}

function paginationFrom(page, limit, total) {
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / parseInt(limit)),
  };
}

/**
 * Get all audit logs with pagination and filters
 */
const getAllAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      adminId,
      targetId,
      startDate,
      endDate,
    } = req.query;

    const where = {};
    if (action) where.action = action;
    if (adminId && isUuid(adminId)) where.adminId = adminId;
    if (targetId && isUuid(targetId)) where.targetId = targetId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const [rows, total] = await Promise.all([
      auditLogs().findMany({
        where,
        include: WITH_ACTORS,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      auditLogs().count({ where }),
    ]);

    res.send({ logs: rows.map(logToApi), pagination: paginationFrom(page, limit, total) });
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Get audit logs for a specific admin
 */
const getAuditLogsByAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { adminId } = req.params;

    if (!isUuid(adminId)) {
      return res.send({ logs: [], pagination: paginationFrom(page, limit, 0) });
    }

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const [rows, total] = await Promise.all([
      auditLogs().findMany({
        where: { adminId },
        include: WITH_ACTORS,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      auditLogs().count({ where: { adminId } }),
    ]);

    res.send({ logs: rows.map(logToApi), pagination: paginationFrom(page, limit, total) });
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Get audit log statistics
 */
const getAuditStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const where = { createdAt: { gte: startDate } };

    // Los $group de Mongo se traducen a groupBy: son agregaciones sobre una
    // sola tabla, sin joins.
    const [actionGroups, adminGroups, failedLogins] = await Promise.all([
      auditLogs().groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
      }),
      auditLogs().groupBy({
        by: ["adminId", "adminEmail", "adminName"],
        where,
        _count: { _all: true },
        orderBy: { _count: { adminId: "desc" } },
        take: 10,
      }),
      auditLogs().findMany({
        where: { action: "LOGIN_FAILED", createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { adminEmail: true, ip: true, createdAt: true, errorMessage: true },
      }),
    ]);

    res.send({
      period: `Last ${days} days`,
      // Se conserva la forma { _id, count } que ya consumía el panel.
      actionStats: actionGroups.map((g) => ({ _id: g.action, count: g._count._all })),
      activeAdmins: adminGroups.map((g) => ({
        _id: { id: g.adminId, email: g.adminEmail, name: g.adminName },
        count: g._count._all,
      })),
      failedLogins,
    });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  getAllAuditLogs,
  getAuditLogsByAdmin,
  getAuditStats,
};
