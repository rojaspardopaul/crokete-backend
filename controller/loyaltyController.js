const Customer = require("../models/Customer");
const LoyaltyConfig = require("../models/LoyaltyConfig");
const PointTransaction = require("../models/PointTransaction");
const LoyaltyReward = require("../models/LoyaltyReward");
const Order = require("../models/Order");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const loyaltyPointsEarnedEmail = require("../lib/email-sender/templates/loyalty-points");
const CONFIG = require("../config");

// ==========================================
// HELPERS
// ==========================================

const generateCouponCode = (prefix = "CRK") => {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
};

const getOrCreateConfig = async () => {
  let config = await LoyaltyConfig.findOne();
  if (!config) {
    config = await LoyaltyConfig.create({
      pointsPerDollar: 1,
      pointValue: 0.1,
      pointsExpireDays: 365,
      minRedeemPoints: 100,
      maxRedeemPercent: 50,
      milestones: [
        { orderCount: 3, discountPercent: 5, label: "3era compra - 5% descuento" },
        { orderCount: 5, discountPercent: 10, label: "5ta compra - 10% descuento" },
        { orderCount: 10, discountPercent: 15, label: "10ma compra - 15% descuento" },
      ],
      tierThresholds: { frecuente: 3, vip: 10 },
      enabled: true,
    });
  }
  return config;
};

const calculateTier = (orderCount, thresholds) => {
  if (orderCount >= thresholds.vip) return "vip";
  if (orderCount >= thresholds.frecuente) return "frecuente";
  return "nuevo";
};

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
      subject: `🐾 ¡Ganaste ${emailOptions.pointsEarned} puntos! - Crokete Rewards`,
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
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /loyalty/config
const getLoyaltyConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.status(200).send(config);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PUT /loyalty/config
const updateLoyaltyConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const updates = req.body;

    if (updates.pointsPerDollar !== undefined)
      config.pointsPerDollar = updates.pointsPerDollar;
    if (updates.pointValue !== undefined)
      config.pointValue = updates.pointValue;
    if (updates.pointsExpireDays !== undefined)
      config.pointsExpireDays = updates.pointsExpireDays;
    if (updates.minRedeemPoints !== undefined)
      config.minRedeemPoints = updates.minRedeemPoints;
    if (updates.maxRedeemPercent !== undefined)
      config.maxRedeemPercent = updates.maxRedeemPercent;
    if (updates.milestones !== undefined)
      config.milestones = updates.milestones;
    if (updates.tierThresholds !== undefined)
      config.tierThresholds = updates.tierThresholds;
    if (updates.enabled !== undefined) config.enabled = updates.enabled;

    await config.save();
    res.status(200).send({ message: "Configuración actualizada", config });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /loyalty/admin/customer/:id  — Admin view of a customer's loyalty
const getCustomerLoyaltyAdmin = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select(
      "name email loyalty"
    );
    if (!customer)
      return res.status(404).send({ message: "Cliente no encontrado" });

    const transactions = await PointTransaction.find({
      customer: req.params.id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const rewards = await LoyaltyReward.find({
      customer: req.params.id,
    }).sort({ createdAt: -1 });

    res.status(200).send({
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        loyalty: customer.loyalty,
      },
      transactions,
      rewards,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
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

    const customer = await Customer.findById(customerId);
    if (!customer)
      return res.status(404).send({ message: "Cliente no encontrado" });

    // Initialize loyalty if needed
    if (!customer.loyalty) {
      customer.loyalty = {
        points: 0,
        totalPoints: 0,
        totalSpent: 0,
        orderCount: 0,
        tier: "nuevo",
        joinedAt: new Date(),
      };
    }

    const newBalance = customer.loyalty.points + points;
    if (newBalance < 0) {
      return res
        .status(400)
        .send({ message: "El ajuste resultaría en un saldo negativo" });
    }

    customer.loyalty.points = newBalance;
    if (points > 0) {
      customer.loyalty.totalPoints += points;
    }
    await customer.save();

    await PointTransaction.create({
      customer: customerId,
      type: "adjusted",
      points,
      balance: newBalance,
      description: `[Admin] ${description}`,
    });

    res.status(200).send({
      message: "Puntos ajustados correctamente",
      newBalance,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /loyalty/admin/customers  — List all customers with loyalty data
const getAllCustomersLoyalty = async (req, res) => {
  try {
    const { page = 1, limit = 20, tier, sortBy = "loyalty.points" } = req.query;

    const filter = {};
    if (tier) filter["loyalty.tier"] = tier;

    const pages = Number(page);
    const limits = Number(limit);

    const customers = await Customer.find(filter)
      .select("name email loyalty createdAt")
      .sort({ [sortBy]: -1 })
      .skip((pages - 1) * limits)
      .limit(limits);

    const totalDoc = await Customer.countDocuments(filter);

    res.status(200).send({
      customers,
      totalDoc,
      limits,
      pages,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
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

    const customer = await Customer.findById(req.user._id);
    if (!customer)
      return res.status(404).send({ message: "Cliente no encontrado" });

    // Initialize loyalty if needed
    if (!customer.loyalty || customer.loyalty.points === undefined) {
      customer.loyalty = {
        points: 0,
        totalPoints: 0,
        totalSpent: 0,
        orderCount: 0,
        tier: "nuevo",
        joinedAt: new Date(),
      };
      await customer.save();
    }

    // Get next milestone
    const sortedMilestones = [...(config.milestones || [])].sort(
      (a, b) => a.orderCount - b.orderCount
    );
    const nextMilestone = sortedMilestones.find(
      (m) => m.orderCount > customer.loyalty.orderCount
    );

    // Calculate points value
    const pointsValue = (customer.loyalty.points * config.pointValue).toFixed(2);

    res.status(200).send({
      enabled: true,
      loyalty: customer.loyalty,
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
        customer.loyalty.tier === "nuevo"
          ? {
              name: "frecuente",
              ordersNeeded:
                config.tierThresholds.frecuente -
                customer.loyalty.orderCount,
            }
          : customer.loyalty.tier === "frecuente"
          ? {
              name: "vip",
              ordersNeeded:
                config.tierThresholds.vip - customer.loyalty.orderCount,
            }
          : null,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /loyalty/history  — Customer's point transaction history
const getPointHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pages = Number(page);
    const limits = Number(limit);

    const transactions = await PointTransaction.find({
      customer: req.user._id,
    })
      .sort({ createdAt: -1 })
      .skip((pages - 1) * limits)
      .limit(limits);

    const totalDoc = await PointTransaction.countDocuments({
      customer: req.user._id,
    });

    res.status(200).send({ transactions, totalDoc, limits, pages });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /loyalty/rewards  — Customer's available rewards/coupons
const getAvailableRewards = async (req, res) => {
  try {
    const rewards = await LoyaltyReward.find({
      customer: req.user._id,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    const usedRewards = await LoyaltyReward.find({
      customer: req.user._id,
      $or: [{ used: true }, { expiresAt: { $lte: new Date() } }],
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).send({ available: rewards, history: usedRewards });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// POST /loyalty/redeem  — Redeem points for a discount coupon
const redeemPoints = async (req, res) => {
  try {
    const { points } = req.body;
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

    const customer = await Customer.findById(req.user._id);
    if (!customer)
      return res.status(404).send({ message: "Cliente no encontrado" });

    if (!customer.loyalty || customer.loyalty.points < points) {
      return res.status(400).send({ message: "Puntos insuficientes" });
    }

    // Calculate discount value
    const discountValue = Number((points * config.pointValue).toFixed(2));
    const couponCode = generateCouponCode("PTS");

    // Create expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create the reward coupon
    const reward = await LoyaltyReward.create({
      customer: req.user._id,
      type: "points_redemption",
      couponCode,
      discountType: "fixed",
      discountValue,
      minimumAmount: 0,
      expiresAt,
      description: `Canje de ${points} puntos por $${discountValue} MXN de descuento`,
      pointsSpent: points,
    });

    // Deduct points
    customer.loyalty.points -= points;
    await customer.save();

    // Record transaction
    await PointTransaction.create({
      customer: req.user._id,
      type: "redeemed",
      points: -points,
      balance: customer.loyalty.points,
      description: `Canjeados ${points} puntos por cupón ${couponCode} ($${discountValue} MXN)`,
      couponGenerated: couponCode,
    });

    res.status(200).send({
      message: "Puntos canjeados exitosamente",
      reward: {
        couponCode: reward.couponCode,
        discountValue: reward.discountValue,
        expiresAt: reward.expiresAt,
        description: reward.description,
      },
      remainingPoints: customer.loyalty.points,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
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

    const reward = await LoyaltyReward.findOne({
      couponCode: couponCode.toUpperCase(),
      customer: req.user._id,
    });

    if (!reward) {
      return res
        .status(404)
        .send({ message: "Cupón de recompensa no encontrado" });
    }

    if (reward.used) {
      return res.status(400).send({ message: "Este cupón ya fue utilizado" });
    }

    if (reward.expiresAt < new Date()) {
      return res.status(400).send({ message: "Este cupón ha expirado" });
    }

    if (orderTotal < reward.minimumAmount) {
      return res.status(400).send({
        message: `Monto mínimo de compra: $${reward.minimumAmount} MXN`,
      });
    }

    let discount = 0;
    if (reward.discountType === "percentage") {
      discount = Number(((orderTotal * reward.discountValue) / 100).toFixed(2));
    } else {
      discount = Math.min(reward.discountValue, orderTotal);
    }

    res.status(200).send({
      valid: true,
      discount,
      couponCode: reward.couponCode,
      discountType: reward.discountType,
      discountValue: reward.discountValue,
      description: reward.description,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// POST /loyalty/use-reward  — Mark a reward as used after checkout
const useReward = async (req, res) => {
  try {
    const { couponCode, orderId } = req.body;

    const reward = await LoyaltyReward.findOne({
      couponCode,
      customer: req.user._id,
      used: false,
    });

    if (!reward) {
      return res
        .status(404)
        .send({ message: "Cupón de recompensa no encontrado o ya usado" });
    }

    reward.used = true;
    reward.usedAt = new Date();
    reward.orderId = orderId;
    await reward.save();

    res.status(200).send({ message: "Cupón aplicado exitosamente" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// ORDER HOOK — Called when order status changes
// ==========================================

const processOrderLoyalty = async (orderId, newStatus, previousStatus) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) return;

    const order = await Order.findById(orderId);
    if (!order) return;

    const customer = await Customer.findById(order.user);
    if (!customer) return;

    // Initialize loyalty if needed
    if (!customer.loyalty || customer.loyalty.points === undefined) {
      customer.loyalty = {
        points: 0,
        totalPoints: 0,
        totalSpent: 0,
        orderCount: 0,
        tier: "nuevo",
        joinedAt: new Date(),
      };
    }

    // CASE 1: Order delivered → award points + check milestones
    if (newStatus === "entregado" && previousStatus !== "entregado") {
      // Check if points already awarded for this order
      const existingTransaction = await PointTransaction.findOne({
        orderId,
        type: "earned",
      });
      if (existingTransaction) return; // Already processed

      // Calculate points (1 point per dollar spent, rounded down)
      const pointsEarned = Math.floor(order.total * config.pointsPerDollar);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.pointsExpireDays);

      // Update customer loyalty
      customer.loyalty.points += pointsEarned;
      customer.loyalty.totalPoints += pointsEarned;
      customer.loyalty.totalSpent += order.total;
      customer.loyalty.orderCount += 1;

      // Update tier
      customer.loyalty.tier = calculateTier(
        customer.loyalty.orderCount,
        config.tierThresholds
      );

      await customer.save();

      // Record points earned transaction
      await PointTransaction.create({
        customer: customer._id,
        type: "earned",
        points: pointsEarned,
        balance: customer.loyalty.points,
        description: `Puntos por pedido #${order.invoice} ($${order.total.toFixed(2)} MXN)`,
        orderId,
        expiresAt,
      });

      // Check milestones
      const milestone = (config.milestones || []).find(
        (m) => m.orderCount === customer.loyalty.orderCount
      );

      let milestoneCoupon = null;
      if (milestone) {
        milestoneCoupon = generateCouponCode("MST");
        const milestoneExpiry = new Date();
        milestoneExpiry.setDate(milestoneExpiry.getDate() + 60); // 60 days to use

        await LoyaltyReward.create({
          customer: customer._id,
          type: "milestone",
          couponCode: milestoneCoupon,
          discountType: "percentage",
          discountValue: milestone.discountPercent,
          minimumAmount: 0,
          expiresAt: milestoneExpiry,
          description: `🎉 ${milestone.label}`,
        });

        // Bonus points for milestone
        const bonusPoints = milestone.orderCount * 10;
        customer.loyalty.points += bonusPoints;
        customer.loyalty.totalPoints += bonusPoints;
        await customer.save();

        await PointTransaction.create({
          customer: customer._id,
          type: "milestone_bonus",
          points: bonusPoints,
          balance: customer.loyalty.points,
          description: `Bonus por milestone: ${milestone.label}`,
          orderId,
        });
      }

      console.log(
        `[Loyalty] Customer ${customer.email}: +${pointsEarned} pts (Order #${order.invoice}), tier: ${customer.loyalty.tier}`
      );

      // Send loyalty email (fire-and-forget)
      const sortedMilestones = [...(config.milestones || [])].sort(
        (a, b) => a.orderCount - b.orderCount
      );
      const nextMilestoneForEmail = sortedMilestones.find(
        (m) => m.orderCount > customer.loyalty.orderCount
      );

      sendLoyaltyEmail({
        name: customer.name,
        email: customer.email,
        invoice: order.invoice,
        pointsEarned,
        totalPoints: customer.loyalty.points,
        tier: customer.loyalty.tier,
        nextMilestone: nextMilestoneForEmail
          ? {
              label: nextMilestoneForEmail.label,
              ordersLeft:
                nextMilestoneForEmail.orderCount -
                customer.loyalty.orderCount,
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
      const earnedTx = await PointTransaction.findOne({
        orderId,
        type: "earned",
      });

      if (earnedTx) {
        const pointsToRevert = earnedTx.points;

        customer.loyalty.points = Math.max(
          0,
          customer.loyalty.points - pointsToRevert
        );
        customer.loyalty.totalSpent = Math.max(
          0,
          customer.loyalty.totalSpent - order.total
        );
        customer.loyalty.orderCount = Math.max(
          0,
          customer.loyalty.orderCount - 1
        );
        customer.loyalty.tier = calculateTier(
          customer.loyalty.orderCount,
          config.tierThresholds
        );

        await customer.save();

        await PointTransaction.create({
          customer: customer._id,
          type: "adjusted",
          points: -pointsToRevert,
          balance: customer.loyalty.points,
          description: `Puntos revertidos - Pedido #${order.invoice} cancelado`,
          orderId,
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
