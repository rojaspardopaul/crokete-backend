const PaymentLog = require("../models/PaymentLog");

/**
 * Logs a payment event to the database.
 * Fire-and-forget: errors are caught internally so the payment flow is never interrupted.
 */
const logPaymentEvent = ({
  orderId = null,
  userId = null,
  userEmail = null,
  event,
  stripePaymentIntentId = null,
  amount = null,
  currency = "mxn",
  status = "pending",
  errorMessage = null,
  metadata = null,
  req = null,
}) => {
  const ip = req
    ? req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null
    : null;
  const userAgent = req ? req.headers["user-agent"] || null : null;

  PaymentLog.create({
    orderId,
    userId,
    userEmail,
    event,
    stripePaymentIntentId,
    amount,
    currency,
    status,
    errorMessage,
    metadata,
    ip,
    userAgent,
  }).catch((err) => {
    console.error("PaymentLog write failed:", err.message);
  });
};

module.exports = { logPaymentEvent };
