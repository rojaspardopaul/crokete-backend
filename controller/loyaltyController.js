const crypto = require("crypto");
const nodemailer = require("nodemailer");
const loyaltyPointsEarnedEmail = require("../lib/email-sender/templates/loyalty-points");
const CONFIG = require("../config");
const { getPrisma } = require("../lib/prisma");
const {
  toApi,
  num,
  customerToApi,
  loyaltyConfigToApi,
} = require("../lib/prisma/presenters");
const { isUuid, fail, notFound } = require("../lib/prisma/helpers");

const prisma = () => getPrisma();

// ==========================================
// HELPERS
// ==========================================

const generateCouponCode = (prefix = "CRK") => {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
};

const DEFAULT_MILESTONES = [
  { orderCount: 3, discountPercent: 5, label: "3era compra - 5% descuento" },
  { orderCount: 5, discountPercent: 10, label: "5ta compra - 10% descuento" },
  { orderCount: 10, discountPercent: 15, label: "10ma compra - 15% descuento" },
];

/**
 * La configuración es una fila única. Se crea con los valores por defecto la
 * primera vez y se devuelve ya en la forma que espera la API (`tierThresholds`
 * reagrupado y los Decimal convertidos a número).
 */
const getOrCreateConfig = async () => {
  const existing = await prisma().loyaltyConfig.findFirst();
  if (existing) return loyaltyConfigToApi(existing);

  const created = await prisma().loyaltyConfig.create({
    data: {
      pointsPerDollar: 1,
      pointValue: 0.1,
      pointsExpireDays: 365,
      minRedeemPoints: 100,
      maxRedeemPercent: 50,
      milestones: DEFAULT_MILESTONES,
      tierThresholdFrecuente: 3,
      tierThresholdVip: 10,
      enabled: true,
    },
  });
  return loyaltyConfigToApi(created);
};

const calculateTier = (orderCount, thresholds) => {
  if (orderCount >= thresholds.vip) return "vip";
  if (orderCount >= thresholds.frecuente) return "frecuente";
  return "nuevo";
};

/**
 * Los agregados de lealtad viven en columnas del cliente. Se devuelven con la
 * forma anidada de siempre para no tocar a la tienda ni al panel.
 */
const loyaltyOf = (customer) => customerToApi(customer).loyalty;

// Send loyalty email (non-blocking, fire-and-forget)
const sendLoyaltyEmail = async (emailOptions) => {
  try {
    const emailHost = (
      process.env.EMAIL_HOST ||
      process.env.HOST ||
      "smtp.gmail.com"
    )
      .replace(/[\r\n\s]+/g, "")
      .trim();
    const emailPort = (process.env.EMAIL_PORT || "465")
      .replace(/[\r\n\s]+/g, "")
      .trim();

    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: parseInt(emailPort) || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const html = loyaltyPointsEarnedEmail(emailOptions);

    await transporter.sendMail({
      from: CONFIG.EMAIL ? CONFIG.EMAIL.FROM : process.env.EMAIL_USER,
      to: emailOptions.email,
      subject: `🐾 ¡Ganaste ${emailOptions.pointsEarned} puntos! - Puntos de Recompensa`,
      html,
    });

    console.log(`[Loyalty] Email sent to ${emailOptions.email}`);
  } catch (err) {
    console.error("[Loyalty] Email send error:", err.message);
  }
};

// ==========================================
// PUBLIC ENDPOINT (no auth required)
// ==========================================

// GET /loyalty/public-config
const getPublicConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    // Only expose non-sensitive fields for the storefront
    res.status(200).send({
      pointsPerDollar: config.pointsPerDollar,
      pointValue: config.pointValue,
      minRedeemPoints: config.minRedeemPoints,
      milestones: config.milestones,
      tierThresholds: config.tierThresholds,
      enabled: config.enabled,
    });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /loyalty/config
const getLoyaltyConfig = async (req, res) => {
  try {
    res.status(200).send(await getOrCreateConfig());
  } catch (err) {
    fail(res, err);
  }
};

// PUT /loyalty/config
const updateLoyaltyConfig = async (req, res) => {
  try {
    const current = await getOrCreateConfig();
    const updates = req.body;

    const data = {};
    if (updates.pointsPerDollar !== undefined) data.pointsPerDollar = updates.pointsPerDollar;
    if (updates.pointValue !== undefined) data.pointValue = updates.pointValue;
    if (updates.pointsExpireDays !== undefined) data.pointsExpireDays = updates.pointsExpireDays;
    if (updates.minRedeemPoints !== undefined) data.minRedeemPoints = updates.minRedeemPoints;
    if (updates.maxRedeemPercent !== undefined) data.maxRedeemPercent = updates.maxRedeemPercent;
    if (updates.milestones !== undefined) data.milestones = updates.milestones;
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    // El panel sigue enviando el subdocumento; aquí se reparte en sus columnas.
    if (updates.tierThresholds !== undefined) {
      const { frecuente, vip } = updates.tierThresholds || {};
      if (frecuente !== undefined) data.tierThresholdFrecuente = Number(frecuente);
      if (vip !== undefined) data.tierThresholdVip = Number(vip);
    }

    const config = loyaltyConfigToApi(
      await prisma().loyaltyConfig.update({ where: { id: current._id }, data })
    );
    res.status(200).send({ message: "Configuración actualizada", config });
  } catch (err) {
    fail(res, err);
  }
};

// GET /loyalty/admin/customer/:id  — Admin view of a customer's loyalty
const getCustomerLoyaltyAdmin = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Cliente no encontrado");

    const customer = await prisma().customer.findUnique({
      where: { id: req.params.id },
      omit: { password: true },
    });
    if (!customer) return notFound(res, "Cliente no encontrado");

    const [transactions, rewards] = await Promise.all([
      prisma().pointTransaction.findMany({
        where: { customerId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma().loyaltyReward.findMany({
        where: { customerId: req.params.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.status(200).send({
      customer: {
        _id: customer.id,
        name: customer.name,
        email: customer.email,
        loyalty: loyaltyOf(customer),
      },
      transactions: transactions.map(toApi),
      rewards: rewards.map(toApi),
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /loyalty/admin/adjust  — Admin manual point adjustment
const adjustPoints = async (req, res) => {
  try {
    const { customerId, points, description } = req.body;

    if (!customerId || points === undefined || !description) {
      return res
        .status(400)
        .send({ message: "customerId, points y description son requeridos" });
    }
    if (!isUuid(customerId)) return notFound(res, "Cliente no encontrado");

    const customer = await prisma().customer.findUnique({ where: { id: customerId } });
    if (!customer) return notFound(res, "Cliente no encontrado");

    const delta = Number(points);
    const newBalance = customer.loyaltyPoints + delta;
    if (newBalance < 0) {
      return res
        .status(400)
        .send({ message: "El ajuste resultaría en un saldo negativo" });
    }

    // Saldo y movimiento se escriben juntos: si algo falla, no queda un ajuste
    // sin su registro en el historial.
    const [updated] = await prisma().$transaction([
      prisma().customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: { increment: delta },
          ...(delta > 0 ? { loyaltyTotalPoints: { increment: delta } } : {}),
        },
      }),
      prisma().pointTransaction.create({
        data: {
          customerId,
          type: "adjusted",
          points: delta,
          balance: newBalance,
          description: `[Admin] ${description}`,
        },
      }),
    ]);

    res.status(200).send({
      message: "Puntos ajustados correctamente",
      newBalance: updated.loyaltyPoints,
    });
  } catch (err) {
    fail(res, err);
  }
};

/** Claves de ordenación heredadas (`loyalty.points`) → columnas. */
const SORT_COLUMNS = {
  "loyalty.points": "loyaltyPoints",
  "loyalty.totalPoints": "loyaltyTotalPoints",
  "loyalty.totalSpent": "loyaltyTotalSpent",
  "loyalty.orderCount": "loyaltyOrderCount",
  createdAt: "createdAt",
};

// GET /loyalty/admin/customers  — List all customers with loyalty data
const getAllCustomersLoyalty = async (req, res) => {
  try {
    const { page = 1, limit = 20, tier, sortBy = "loyalty.points" } = req.query;

    const where = {};
    if (tier) where.loyaltyTier = tier;

    const pages = Number(page) || 1;
    const limits = Number(limit) || 20;
    const orderBy = { [SORT_COLUMNS[sortBy] || "loyaltyPoints"]: "desc" };

    const [customers, totalDoc] = await Promise.all([
      prisma().customer.findMany({
        where,
        orderBy,
        skip: (pages - 1) * limits,
        take: limits,
        omit: { password: true },
      }),
      prisma().customer.count({ where }),
    ]);

    res.status(200).send({
      customers: customers.map((c) => ({
        _id: c.id,
        id: c.id,
        name: c.name,
        email: c.email,
        loyalty: loyaltyOf(c),
        createdAt: c.createdAt,
      })),
      totalDoc,
      limits,
      pages,
    });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// CUSTOMER ENDPOINTS
// ==========================================

// GET /loyalty/my  — Customer's own loyalty summary
const getMyLoyalty = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res
        .status(200)
        .send({ enabled: false, message: "Programa de lealtad desactivado" });
    }

    if (!isUuid(req.user._id)) return notFound(res, "Cliente no encontrado");
    const customer = await prisma().customer.findUnique({ where: { id: req.user._id } });
    if (!customer) return notFound(res, "Cliente no encontrado");

    // Los agregados tienen valor por defecto en la base: ya no hace falta
    // inicializarlos a mano en la primera lectura.
    const loyalty = loyaltyOf(customer);

    // Get next milestone
    const sortedMilestones = [...(config.milestones || [])].sort(
      (a, b) => a.orderCount - b.orderCount
    );
    const nextMilestone = sortedMilestones.find(
      (m) => m.orderCount > loyalty.orderCount
    );

    // Calculate points value
    const pointsValue = (loyalty.points * config.pointValue).toFixed(2);

    res.status(200).send({
      enabled: true,
      loyalty,
      pointsValue: Number(pointsValue),
      config: {
        pointsPerDollar: config.pointsPerDollar,
        pointValue: config.pointValue,
        minRedeemPoints: config.minRedeemPoints,
        maxRedeemPercent: config.maxRedeemPercent,
        milestones: config.milestones,
      },
      nextMilestone: nextMilestone || null,
      nextTier:
        loyalty.tier === "nuevo"
          ? {
              name: "frecuente",
              ordersNeeded: config.tierThresholds.frecuente - loyalty.orderCount,
            }
          : loyalty.tier === "frecuente"
          ? {
              name: "vip",
              ordersNeeded: config.tierThresholds.vip - loyalty.orderCount,
            }
          : null,
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /loyalty/history  — Customer's point transaction history
const getPointHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pages = Number(page) || 1;
    const limits = Number(limit) || 20;

    if (!isUuid(req.user._id)) {
      return res.status(200).send({ transactions: [], totalDoc: 0, limits, pages });
    }
    const where = { customerId: req.user._id };

    const [transactions, totalDoc] = await Promise.all([
      prisma().pointTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pages - 1) * limits,
        take: limits,
      }),
      prisma().pointTransaction.count({ where }),
    ]);

    res.status(200).send({ transactions: transactions.map(toApi), totalDoc, limits, pages });
  } catch (err) {
    fail(res, err);
  }
};

// GET /loyalty/rewards  — Customer's available rewards/coupons
const getAvailableRewards = async (req, res) => {
  try {
    if (!isUuid(req.user._id)) {
      return res.status(200).send({ available: [], history: [] });
    }
    const now = new Date();

    const [rewards, usedRewards] = await Promise.all([
      prisma().loyaltyReward.findMany({
        where: { customerId: req.user._id, used: false, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      }),
      prisma().loyaltyReward.findMany({
        where: {
          customerId: req.user._id,
          OR: [{ used: true }, { expiresAt: { lte: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    res.status(200).send({
      available: rewards.map(toApi),
      history: usedRewards.map(toApi),
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /loyalty/redeem  — Redeem points for a discount coupon
const redeemPoints = async (req, res) => {
  try {
    const points = Number(req.body.points);
    const config = await getOrCreateConfig();

    if (!config.enabled) {
      return res
        .status(400)
        .send({ message: "Programa de lealtad desactivado" });
    }

    if (!points || points <= 0) {
      return res
        .status(400)
        .send({ message: "Cantidad de puntos inválida" });
    }

    if (points < config.minRedeemPoints) {
      return res.status(400).send({
        message: `Mínimo ${config.minRedeemPoints} puntos para canjear`,
      });
    }

    if (!isUuid(req.user._id)) return notFound(res, "Cliente no encontrado");
    const customer = await prisma().customer.findUnique({ where: { id: req.user._id } });
    if (!customer) return notFound(res, "Cliente no encontrado");

    if (customer.loyaltyPoints < points) {
      return res.status(400).send({ message: "Puntos insuficientes" });
    }

    // Calculate discount value
    const discountValue = Number((points * config.pointValue).toFixed(2));
    const couponCode = generateCouponCode("PTS");

    // Create expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const remainingPoints = customer.loyaltyPoints - points;

    // Cupón, descuento de puntos y movimiento se escriben en una transacción:
    // antes podía quedar un cupón emitido sin haber descontado los puntos.
    const [reward] = await prisma().$transaction([
      prisma().loyaltyReward.create({
        data: {
          customerId: req.user._id,
          type: "points_redemption",
          couponCode,
          discountType: "fixed",
          discountValue,
          minimumAmount: 0,
          expiresAt,
          description: `Canje de ${points} puntos por $${discountValue} MXN de descuento`,
          pointsSpent: points,
        },
      }),
      prisma().customer.update({
        where: { id: req.user._id },
        data: { loyaltyPoints: { decrement: points } },
      }),
      prisma().pointTransaction.create({
        data: {
          customerId: req.user._id,
          type: "redeemed",
          points: -points,
          balance: remainingPoints,
          description: `Canjeados ${points} puntos por cupón ${couponCode} ($${discountValue} MXN)`,
          couponGenerated: couponCode,
        },
      }),
    ]);

    res.status(200).send({
      message: "Puntos canjeados exitosamente",
      reward: {
        couponCode: reward.couponCode,
        discountValue: num(reward.discountValue),
        expiresAt: reward.expiresAt,
        description: reward.description,
      },
      remainingPoints,
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /loyalty/apply-reward  — Apply a loyalty reward coupon at checkout
const applyReward = async (req, res) => {
  try {
    const { couponCode, orderTotal } = req.body;

    if (!couponCode || !orderTotal) {
      return res
        .status(400)
        .send({ message: "couponCode y orderTotal son requeridos" });
    }
    if (!isUuid(req.user._id)) {
      return notFound(res, "Cupón de recompensa no encontrado");
    }

    const reward = await prisma().loyaltyReward.findFirst({
      where: {
        couponCode: couponCode.toUpperCase(),
        customerId: req.user._id,
      },
    });

    if (!reward) {
      return notFound(res, "Cupón de recompensa no encontrado");
    }

    if (reward.used) {
      return res.status(400).send({ message: "Este cupón ya fue utilizado" });
    }

    if (reward.expiresAt < new Date()) {
      return res.status(400).send({ message: "Este cupón ha expirado" });
    }

    const discountValue = num(reward.discountValue);
    const minimumAmount = num(reward.minimumAmount);

    if (orderTotal < minimumAmount) {
      return res.status(400).send({
        message: `Monto mínimo de compra: $${minimumAmount} MXN`,
      });
    }

    let discount = 0;
    if (reward.discountType === "percentage") {
      discount = Number(((orderTotal * discountValue) / 100).toFixed(2));
    } else {
      discount = Math.min(discountValue, orderTotal);
    }

    res.status(200).send({
      valid: true,
      discount,
      couponCode: reward.couponCode,
      discountType: reward.discountType,
      discountValue,
      description: reward.description,
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /loyalty/use-reward  — Mark a reward as used after checkout
const useReward = async (req, res) => {
  try {
    const { couponCode, orderId } = req.body;

    if (!isUuid(req.user._id)) {
      return notFound(res, "Cupón de recompensa no encontrado o ya usado");
    }

    // Se marca con una sola sentencia condicionada a que siga sin usar: dos
    // peticiones simultáneas ya no pueden gastar el mismo cupón dos veces.
    const marked = await prisma().loyaltyReward.updateMany({
      where: {
        couponCode,
        customerId: req.user._id,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
        orderId: isUuid(orderId) ? orderId : null,
      },
    });

    if (marked.count === 0) {
      return notFound(res, "Cupón de recompensa no encontrado o ya usado");
    }

    res.status(200).send({ message: "Cupón aplicado exitosamente" });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// ORDER HOOK — Called when order status changes
// ==========================================

const processOrderLoyalty = async (orderId, newStatus, previousStatus) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) return;
    if (!isUuid(orderId)) return;

    const order = await prisma().order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const customer = await prisma().customer.findUnique({
      where: { id: order.customerId },
    });
    if (!customer) return;

    const orderTotal = num(order.total);

    // CASE 1: Order delivered → award points + check milestones
    if (newStatus === "entregado" && previousStatus !== "entregado") {
      // Check if points already awarded for this order
      const existingTransaction = await prisma().pointTransaction.findFirst({
        where: { orderId, type: "earned" },
      });
      if (existingTransaction) return; // Already processed

      // Calculate points (1 point per dollar spent, rounded down)
      const pointsEarned = Math.floor(orderTotal * config.pointsPerDollar);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.pointsExpireDays);

      const orderCount = customer.loyaltyOrderCount + 1;
      const tier = calculateTier(orderCount, config.tierThresholds);

      // Update customer loyalty — los incrementos los resuelve la base, así que
      // dos pedidos entregados a la vez no se pisan el saldo.
      const updated = await prisma().customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: { increment: pointsEarned },
          loyaltyTotalPoints: { increment: pointsEarned },
          loyaltyTotalSpent: { increment: orderTotal },
          loyaltyOrderCount: { increment: 1 },
          loyaltyTier: tier,
        },
      });

      // Record points earned transaction
      await prisma().pointTransaction.create({
        data: {
          customerId: customer.id,
          type: "earned",
          points: pointsEarned,
          balance: updated.loyaltyPoints,
          description: `Puntos por pedido #${order.invoice} ($${orderTotal.toFixed(2)} MXN)`,
          orderId,
          expiresAt,
        },
      });

      // Check milestones
      const milestone = (config.milestones || []).find(
        (m) => m.orderCount === updated.loyaltyOrderCount
      );

      let milestoneCoupon = null;
      let balance = updated.loyaltyPoints;
      if (milestone) {
        milestoneCoupon = generateCouponCode("MST");
        const milestoneExpiry = new Date();
        milestoneExpiry.setDate(milestoneExpiry.getDate() + 60); // 60 days to use

        await prisma().loyaltyReward.create({
          data: {
            customerId: customer.id,
            type: "milestone",
            couponCode: milestoneCoupon,
            discountType: "percentage",
            discountValue: milestone.discountPercent,
            minimumAmount: 0,
            expiresAt: milestoneExpiry,
            description: `🎉 ${milestone.label}`,
          },
        });

        // Bonus points for milestone
        const bonusPoints = milestone.orderCount * 10;
        const withBonus = await prisma().customer.update({
          where: { id: customer.id },
          data: {
            loyaltyPoints: { increment: bonusPoints },
            loyaltyTotalPoints: { increment: bonusPoints },
          },
        });
        balance = withBonus.loyaltyPoints;

        await prisma().pointTransaction.create({
          data: {
            customerId: customer.id,
            type: "milestone_bonus",
            points: bonusPoints,
            balance,
            description: `Bonus por milestone: ${milestone.label}`,
            orderId,
          },
        });
      }

      console.log(
        `[Loyalty] Customer ${customer.email}: +${pointsEarned} pts (Order #${order.invoice}), tier: ${tier}`
      );

      // Send loyalty email (fire-and-forget)
      const sortedMilestones = [...(config.milestones || [])].sort(
        (a, b) => a.orderCount - b.orderCount
      );
      const nextMilestoneForEmail = sortedMilestones.find(
        (m) => m.orderCount > updated.loyaltyOrderCount
      );

      sendLoyaltyEmail({
        name: customer.name,
        email: customer.email,
        invoice: order.invoice,
        pointsEarned,
        totalPoints: balance,
        tier,
        nextMilestone: nextMilestoneForEmail
          ? {
              label: nextMilestoneForEmail.label,
              ordersLeft:
                nextMilestoneForEmail.orderCount - updated.loyaltyOrderCount,
            }
          : null,
        milestoneReward: milestone
          ? {
              description: milestone.label,
              couponCode: milestoneCoupon,
            }
          : null,
      }).catch((err) =>
        console.error("[Loyalty] Email error:", err.message)
      );
    }

    // CASE 2: Order cancelled → revert points if already given
    if (newStatus === "cancelado" && previousStatus === "entregado") {
      const earnedTx = await prisma().pointTransaction.findFirst({
        where: { orderId, type: "earned" },
      });

      if (earnedTx) {
        const pointsToRevert = earnedTx.points;
        const orderCount = Math.max(0, customer.loyaltyOrderCount - 1);

        const reverted = await prisma().customer.update({
          where: { id: customer.id },
          data: {
            // GREATEST(0, …) no existe como operador de Prisma: se calculan los
            // valores mínimos aquí para no dejar saldos negativos.
            loyaltyPoints: Math.max(0, customer.loyaltyPoints - pointsToRevert),
            loyaltyTotalSpent: Math.max(
              0,
              num(customer.loyaltyTotalSpent) - orderTotal
            ),
            loyaltyOrderCount: orderCount,
            loyaltyTier: calculateTier(orderCount, config.tierThresholds),
          },
        });

        await prisma().pointTransaction.create({
          data: {
            customerId: customer.id,
            type: "adjusted",
            points: -pointsToRevert,
            balance: reverted.loyaltyPoints,
            description: `Puntos revertidos - Pedido #${order.invoice} cancelado`,
            orderId,
          },
        });

        console.log(
          `[Loyalty] Customer ${customer.email}: -${pointsToRevert} pts reverted (Order #${order.invoice} cancelled)`
        );
      }
    }
  } catch (err) {
    console.error("[Loyalty] Error processing order loyalty:", err.message);
    // Don't throw — loyalty errors shouldn't break order flow
  }
};

module.exports = {
  getPublicConfig,
  getLoyaltyConfig,
  updateLoyaltyConfig,
  getCustomerLoyaltyAdmin,
  adjustPoints,
  getAllCustomersLoyalty,
  getMyLoyalty,
  getPointHistory,
  getAvailableRewards,
  redeemPoints,
  applyReward,
  useReward,
  processOrderLoyalty,
};
