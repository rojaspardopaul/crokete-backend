const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGOUT",
        "CREATE_ADMIN",
        "UPDATE_ADMIN",
        "DELETE_ADMIN",
        "UPDATE_STATUS",
        "UPDATE_ROLE",
        "UPDATE_PROFILE",
        "PASSWORD_RESET",
        "PASSWORD_CHANGE",
      ],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    targetEmail: {
      type: String,
      default: null,
    },
    targetRole: {
      type: String,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
