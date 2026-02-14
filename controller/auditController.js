const AuditLog = require("../models/AuditLog");

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

    const query = {};

    // Apply filters
    if (action) query.action = action;
    if (adminId) query.adminId = adminId;
    if (targetId) query.targetId = targetId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("adminId", "name email")
      .populate("targetId", "name email");

    const total = await AuditLog.countDocuments(query);

    res.send({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

/**
 * Get audit logs for a specific admin
 */
const getAuditLogsByAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { adminId } = req.params;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find({ adminId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("targetId", "name email");

    const total = await AuditLog.countDocuments({ adminId });

    res.send({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
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

    // Get counts by action
    const actionStats = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get most active admins
    const activeAdmins = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { id: "$adminId", email: "$adminEmail", name: "$adminName" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Get recent failed logins
    const failedLogins = await AuditLog.find({
      action: "LOGIN_FAILED",
      createdAt: { $gte: startDate },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("adminEmail ip createdAt errorMessage");

    res.send({
      period: `Last ${days} days`,
      actionStats,
      activeAdmins,
      failedLogins,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

module.exports = {
  getAllAuditLogs,
  getAuditLogsByAdmin,
  getAuditStats,
};
