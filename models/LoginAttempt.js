const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    ip: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      required: true,
      default: 1,
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
loginAttemptSchema.index({ email: 1, ip: 1 });
loginAttemptSchema.index({ blockedUntil: 1 });

// Automatically remove old records after 24 hours
loginAttemptSchema.index({ lastAttempt: 1 }, { expireAfterSeconds: 86400 });

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);

module.exports = LoginAttempt;
