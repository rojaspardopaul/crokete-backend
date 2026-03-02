const mongoose = require("mongoose");

const pointTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["earned", "redeemed", "expired", "adjusted", "milestone_bonus"],
      required: true,
    },
    points: {
      type: Number,
      required: true, // positive for earned, negative for redeemed/expired
    },
    balance: {
      type: Number,
      required: true, // running balance after this transaction
    },
    description: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false,
    },
    couponGenerated: {
      type: String,
      required: false, // coupon code if points were redeemed for a coupon
    },
    expiresAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
pointTransactionSchema.index({ customer: 1, createdAt: -1 });
pointTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PointTransaction = mongoose.model(
  "PointTransaction",
  pointTransactionSchema
);
module.exports = PointTransaction;
