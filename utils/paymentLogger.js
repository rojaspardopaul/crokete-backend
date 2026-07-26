const { getPrisma } = require("../lib/prisma");
const { isUuid } = require("../lib/prisma/helpers");

/**
 * Logs a payment event to the database.
 * Fire-and-forget: errors are caught internally so the payment flow is never interrupted.
 *
 * Las referencias a pedido y cliente son claves foráneas: si el id no es un uuid
 * válido (por ejemplo un token emitido antes de la migración) se guarda el
 * evento sin la referencia en vez de perder el registro entero.
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
  const numericAmount = amount === null || amount === undefined ? null : Number(amount);

  getPrisma()
    .paymentLog.create({
      data: {
        orderId: isUuid(orderId) ? orderId : null,
        customerId: isUuid(userId) ? userId : null,
        userEmail: userEmail ? String(userEmail).toLowerCase() : null,
        event,
        stripePaymentIntentId,
        amount: Number.isFinite(numericAmount) ? numericAmount : null,
        currency,
        status,
        errorMessage,
        metadata: metadata ?? undefined,
        ip,
        userAgent,
      },
    })
    .catch((err) => {
      console.error("PaymentLog write failed:", err.message);
    });
};

module.exports = { logPaymentEvent };
