const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, fail } = require("../lib/prisma/helpers");

const paymentLogs = () => getPrisma().paymentLog;

/**
 * `event` y `status` son enums en Postgres: un valor que no exista haría fallar
 * la consulta entera con un error de tipo, así que se descarta el filtro (en
 * Mongo simplemente no casaba ninguna fila).
 */
const EVENTS = [
  "PAYMENT_INTENT_CREATED",
  "PAYMENT_INTENT_UPDATED",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "ORDER_CREATED",
  "ORDER_CREATION_FAILED",
  "WEBHOOK_RECEIVED",
  "REFUND_INITIATED",
  "ORDER_AMOUNT_MISMATCH",
  "RAZORPAY_SIGNATURE_INVALID",
  "RAZORPAY_PAYMENT_INVALID",
  "RAZORPAY_VERIFY_ERROR",
];
const STATUSES = ["success", "error", "pending"];

const getPaymentLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      event,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const where = {};

    if (event && EVENTS.includes(event)) where.event = event;
    if (status && STATUSES.includes(status)) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: "insensitive" } },
        { stripePaymentIntentId: { contains: search, mode: "insensitive" } },
      ];
    }

    const pages = Number(page) || 1;
    const limits = Number(limit) || 20;
    const skip = (pages - 1) * limits;

    const [logs, totalDoc] = await Promise.all([
      paymentLogs().findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limits,
      }),
      paymentLogs().count({ where }),
    ]);

    res.send({ logs: logs.map(toApi), totalDoc, page: pages, limit: limits });
  } catch (err) {
    fail(res, err);
  }
};

const getPaymentLogsByOrder = async (req, res) => {
  try {
    if (!isUuid(req.params.orderId)) return res.send([]);
    const logs = await paymentLogs().findMany({
      where: { orderId: req.params.orderId },
      orderBy: { createdAt: "desc" },
    });
    res.send(logs.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

module.exports = { getPaymentLogs, getPaymentLogsByOrder };
