const mongoose = require("mongoose");

const paymentLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    userEmail: {
      type: String,
      default: null,
      lowercase: true,
    },
    event: {
      type: String,
      required: true,
      enum: [
        "PAYMENT_INTENT_CREATED",
        "PAYMENT_INTENT_UPDATED",
        "PAYMENT_SUCCEEDED",
        "PAYMENT_FAILED",
        "ORDER_CREATED",
        "ORDER_CREATION_FAILED",
        "WEBHOOK_RECEIVED",
        "REFUND_INITIATED",
      ],
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: "mxn",
    },
    status: {
      type: String,
      enum: ["success", "error", "pending"],
      default: "pending",
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
paymentLogSchema.index({ orderId: 1, createdAt: -1 });
paymentLogSchema.index({ userId: 1, createdAt: -1 });
paymentLogSchema.index({ event: 1, createdAt: -1 });
paymentLogSchema.index({ stripePaymentIntentId: 1 });
paymentLogSchema.index({ status: 1, createdAt: -1 });
paymentLogSchema.index({ createdAt: -1 });

const PaymentLog = mongoose.model("PaymentLog", paymentLogSchema);

module.exports = PaymentLog;
