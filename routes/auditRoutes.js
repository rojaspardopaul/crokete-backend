const express = require("express");
const router = express.Router();

const {
  getAllAuditLogs,
  getAuditLogsByAdmin,
  getAuditStats,
} = require("../controller/auditController");

const { isAuth, isSuperAdmin } = require("../config/auth");

/**
 * All audit routes require authentication and super admin privileges
 */

// Get all audit logs with pagination and filters
router.get("/", isAuth, isSuperAdmin, getAllAuditLogs);

// Get audit statistics
router.get("/stats", isAuth, isSuperAdmin, getAuditStats);

// Get audit logs for a specific admin
router.get("/:adminId", isAuth, isSuperAdmin, getAuditLogsByAdmin);

module.exports = router;
