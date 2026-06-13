require("dotenv").config();
const crypto = require("crypto");
const stripe = require("stripe");
const Razorpay = require("razorpay");
const MailChecker = require("mailchecker");
const CONFIG = require("../config");

const mongoose = require("mongoose");

const Order = require("../models/Order");
const Setting = require("../models/Setting");
const { sendEmail, sendEmailAsync } = require("../lib/email-sender/sender");
const { formatAmountForStripe } = require("../lib/stripe/stripe");
const { handleCreateInvoice } = require("../lib/email-sender/create");
const { handleProductQuantity } = require("../lib/stock-controller/others");
const customerInvoiceEmailBody = require("../lib/email-sender/templates/order-to-customer");
const orderConfirmedEmailBody = require("../lib/email-sender/templates/order-to-customer/order-confirmed");
const { logPaymentEvent } = require("../utils/paymentLogger");
const { getStripeConfig } = require("../utils/getConfig");

/**
 * Calcula el IVA incluido en el total (precio con IVA incluido).
 * taxAmount = total × taxRate / (100 + taxRate)
 */
const calculateTax = async (total) => {
  const globalSetting = await Setting.findOne({ name: "globalSetting" }).lean();
  const taxRate = Number(globalSetting?.setting?.tax_rate) || 16;
  const taxAmount = Math.round((total * taxRate / (100 + taxRate)) * 100) / 100;
  return { taxRate, taxAmount };
};

/**
 * Valida el costo de envío contra las tarifas configuradas en la DB.
 * Devuelve null si es válido, o un mensaje de error si no.
 */
const validateShippingCost = async (shippingCost, shippingOption, cartTotal) => {
  const globalSetting = await Setting.findOne({ name: "globalSetting" }).lean();
  const s = globalSetting?.setting || {};

  const freeThreshold = Number(s.free_shipping_threshold) || 599;
  const rate1 = Number(s.shipping_one_cost) || 0;
  const rate2 = Number(s.shipping_two_cost) || 0;

  const isFreeShipping = cartTotal >= freeThreshold;

  if (isFreeShipping) {
    if (Number(shippingCost) !== 0) {
      return "El envío debería ser gratuito para este pedido.";
    }
    return null;
  }

  const validRates = [rate1, rate2].filter((r) => r > 0);

  // Si no hay tarifas configuradas en el admin, omitir validación
  if (validRates.length === 0) return null;

  const cost = Number(shippingCost);
  const isValid = validRates.some((r) => Math.abs(r - cost) < 0.01);
  if (!isValid) {
    return `Costo de envío inválido. Tarifas válidas: ${validRates.join(", ")} MXN.`;
  }

  return null;
};

const addOrder = async (req, res) => {
  try {
    const { paymentMethod, total, subTotal, shippingCost, shippingOption, cart } = req.body;

    // Validar costo de envío contra tarifas configuradas en DB
    const cartTotal = Number(subTotal) || 0;
    const shippingError = await validateShippingCost(shippingCost, shippingOption, cartTotal);
    if (shippingError) {
      return res.status(400).send({ message: shippingError });
    }

    // Verify Stripe payment before saving order (prevents fraudulent orders)
    if (paymentMethod === "Card" && req.body.stripePaymentIntentId) {
      const { secretKey } = await getStripeConfig();
      const stripeInstance = stripe(secretKey);
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(
        req.body.stripePaymentIntentId
      );
      if (paymentIntent.status !== "succeeded") {
        logPaymentEvent({
          userId: req.user._id,
          userEmail: req.body.user_info?.email,
          event: "ORDER_CREATION_FAILED",
          stripePaymentIntentId: req.body.stripePaymentIntentId,
          amount: total,
          status: "error",
          errorMessage: `Payment not confirmed. Status: ${paymentIntent.status}`,
          req,
        });
        return res.status(400).send({
          message: "El pago no ha sido confirmado. Por favor, inténtalo de nuevo.",
        });
      }

      // Verificar que el monto cobrado en Stripe coincide con el total del pedido
      const expectedAmount = formatAmountForStripe(Number(total), "mxn");
      if (Math.abs(paymentIntent.amount - expectedAmount) > 2) {
        logPaymentEvent({
          userId: req.user._id,
          userEmail: req.body.user_info?.email,
          event: "ORDER_AMOUNT_MISMATCH",
          stripePaymentIntentId: req.body.stripePaymentIntentId,
          amount: total,
          status: "error",
          errorMessage: `PI amount ${paymentIntent.amount} != expected ${expectedAmount}`,
          req,
        });
        return res.status(400).send({
          message: "El monto del pago no corresponde al total del pedido.",
        });
      }
    }

    // Idempotency guard: if this PaymentIntent already has an order, return it instead of creating a duplicate
    const stripePaymentIntentId = req.body.stripePaymentIntentId || null;
    if (stripePaymentIntentId) {
      const existing = await Order.findOne({ stripePaymentIntentId }).lean();
      if (existing) {
        return res.status(200).send(existing);
      }
    }

    // Get the latest invoice number
    const lastOrder = await Order.findOne({})
      .sort({ invoice: -1 })
      .select("invoice")
      .lean();

    const nextInvoice = lastOrder ? lastOrder.invoice + 1 : 10000;

    const { taxRate, taxAmount } = await calculateTax(Number(total));

    const newOrder = new Order({
      ...req.body,
      user: req.user._id,
      invoice: nextInvoice,
      stripePaymentIntentId,
      taxRate,
      taxAmount,
    });

    let order;
    try {
      order = await newOrder.save();
    } catch (saveErr) {
      // MongoDB duplicate key on stripePaymentIntentId — order already exists (race condition)
      if (saveErr.code === 11000 && saveErr.keyPattern?.stripePaymentIntentId) {
        const existing = await Order.findOne({ stripePaymentIntentId }).lean();
        if (existing) return res.status(200).send(existing);
      }
      throw saveErr;
    }

    logPaymentEvent({
      orderId: order._id,
      userId: req.user._id,
      userEmail: req.body.user_info?.email,
      event: "ORDER_CREATED",
      stripePaymentIntentId: stripePaymentIntentId,
      amount: order.total,
      status: "success",
      metadata: { paymentMethod: order.paymentMethod, invoice: order.invoice },
      req,
    });

    res.status(201).send(order);
    handleProductQuantity(order.cart);

    // Fire-and-forget order confirmation email
    (async () => {
      try {
        const setting = await Setting.findOne({ name: "storeSetting" }).lean();
        const currency = setting?.setting?.default_currency || "$";
        const user = order.user_info || {};
        // Build a readable address from the new structured fields (calle, colonia, municipio, etc.)
        // Falls back to the legacy flat "address" field if the new fields are absent.
        let addressStr = "";
        if (user.calle || user.colonia || user.municipio) {
          const street = [
            user.calle,
            user.numExterior,
            user.numInterior ? `Int. ${user.numInterior}` : null,
          ].filter(Boolean).join(" ");
          addressStr = [
            street || null,
            user.colonia ? `Col. ${user.colonia}` : null,
            user.municipio,
            user.postalCode ? `C.P. ${user.postalCode}` : null,
            user.estado,
            user.pais,
          ].filter(Boolean).join(", ");
        } else {
          // legacy fallback
          addressStr = [user.address, user.city, user.country, user.zipCode].filter(Boolean).join(", ");
        }
        const option = {
          invoice: order.invoice,
          name: user.name,
          email: user.email,
          phone: user.contact,
          address: addressStr,
          cart: order.cart || [],
          subTotal: (order.cart || []).reduce((acc, item) => acc + ((item.originalPrice || item.price) * item.quantity), 0),
          shipping: order.shippingCost || 0,
          discount: order.discount || 0,
          taxRate: order.taxRate || 16,
          taxAmount: order.taxAmount || 0,
          total: order.total || 0,
          method: order.paymentMethod,
          currency,
        };
        if (user.email) {
          await sendEmailAsync({
            from: CONFIG.EMAIL.FROM,
            to: user.email,
            subject: `¡Tu pedido #${order.invoice} fue confirmado! - ${CONFIG.COMPANY.NAME}`,
            html: orderConfirmedEmailBody(option),
          });
        }
      } catch (emailErr) {
        console.error("Order confirmation email error:", emailErr.message);
      }
    })();
  } catch (err) {
    logPaymentEvent({
      userId: req.user?._id,
      userEmail: req.body.user_info?.email,
      event: "ORDER_CREATION_FAILED",
      stripePaymentIntentId: req.body.stripePaymentIntentId || null,
      amount: req.body.total,
      status: "error",
      errorMessage: err.message,
      req,
    });

    res.status(500).send({
      message: err.message,
    });
  }
};

//create payment intent for stripe
const createPaymentIntent = async (req, res) => {
  const { total: amount, cardInfo: payment_intent, email } = req.body;
  // console.log("req.body", req.body);
  // Validate the amount that was passed from the client.
  const min = Number(process.env.MIN_AMOUNT) || 1;
  const max = Number(process.env.MAX_AMOUNT) || 1_000_000;
  if (amount < min || amount > max) {
    return res.status(500).json({ message: "Invalid amount." });
  }

  const { secretKey } = await getStripeConfig();
  if (!secretKey) {
    console.error("❌ Stripe secret key not configured. Set STRIPE_SECRET in .env or stripe_secret in Store Settings");
    return res.status(500).json({ message: "Stripe no está configurado. Contacta al administrador." });
  }
  const stripeInstance = stripe(secretKey);
  if (payment_intent?.id) {
    try {
      const current_intent = await stripeInstance.paymentIntents.retrieve(
        payment_intent.id
      );
      // If PaymentIntent has been created, just update the amount.
      if (current_intent) {
        const updated_intent = await stripeInstance.paymentIntents.update(
          payment_intent.id,
          {
            amount: formatAmountForStripe(amount, "mxn"),
          }
        );

        logPaymentEvent({
          userId: req.user?._id,
          userEmail: email,
          event: "PAYMENT_INTENT_UPDATED",
          stripePaymentIntentId: payment_intent.id,
          amount,
          status: "success",
          req,
        });

        return res.send(updated_intent);
      }
    } catch (err) {
      // console.log("error", err);

      if (err.code !== "resource_missing") {
        const errorMessage =
          err instanceof Error ? err.message : "Internal server error";
        return res.status(500).send({ message: errorMessage });
      }
    }
  }
  try {
    // Create PaymentIntent from body params.
    const params = {
      amount: formatAmountForStripe(amount, "mxn"),
      currency: "mxn",
      description: process.env.STRIPE_PAYMENT_DESCRIPTION || "",
      automatic_payment_methods: {
        enabled: true,
      },
      /* receipt_email: email,
      metadata: {
        orderId: new Date().getMilliseconds().toString() || "12345",
        customerEmail: email,
      }, */
    };
    const payment_intent = await stripeInstance.paymentIntents.create(params);

    logPaymentEvent({
      userId: req.user?._id,
      userEmail: email,
      event: "PAYMENT_INTENT_CREATED",
      stripePaymentIntentId: payment_intent.id,
      amount,
      status: "success",
      req,
    });

    res.send(payment_intent);
  } catch (err) {
    logPaymentEvent({
      userId: req.user?._id,
      userEmail: email,
      event: "PAYMENT_FAILED",
      amount,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Internal server error",
      req,
    });

    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).send({ message: errorMessage });
  }
};

const createOrderByRazorPay = async (req, res) => {
  try {
    const storeSetting = await Setting.findOne({ name: "storeSetting" });
    // console.log("createOrderByRazorPay", storeSetting?.setting);

    const instance = new Razorpay({
      key_id: storeSetting?.setting?.razorpay_id,
      key_secret: storeSetting?.setting?.razorpay_secret,
    });

    const options = {
      amount: req.body.amount * 100,
      currency: "INR",
    };
    const order = await instance.orders.create(options);

    if (!order)
      return res.status(500).send({
        message: "Error occurred when creating order!",
      });
    res.send(order);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const addRazorpayOrder = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verificar firma HMAC-SHA256 de Razorpay antes de crear el pedido
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).send({ message: "Datos de verificación de pago incompletos." });
    }

    const storeSetting = await Setting.findOne({ name: "storeSetting" }).lean();
    const razorpaySecret = storeSetting?.setting?.razorpay_secret;
    if (!razorpaySecret) {
      return res.status(500).send({ message: "Razorpay no está configurado." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logPaymentEvent({
        userId: req.user._id,
        userEmail: req.body.user_info?.email,
        event: "RAZORPAY_SIGNATURE_INVALID",
        amount: req.body.total,
        status: "error",
        errorMessage: "Razorpay signature mismatch",
        req,
      });
      return res.status(400).send({ message: "Verificación de pago fallida." });
    }

    // Verificar contra la API de Razorpay que el pago existe, pertenece a esta
    // orden y está CAPTURADO por el monto completo. La firma sola no garantiza
    // que los fondos se capturaron ni el monto. (Comparamos contra la orden de
    // Razorpay para evitar el desajuste de moneda MXN/INR; la conversión
    // moneda↔total del pedido queda como decisión de producto — ver nota.)
    try {
      const instance = new Razorpay({
        key_id: storeSetting?.setting?.razorpay_id,
        key_secret: razorpaySecret,
      });
      const [payment, rzpOrder] = await Promise.all([
        instance.payments.fetch(razorpay_payment_id),
        instance.orders.fetch(razorpay_order_id),
      ]);

      const captured = payment?.status === "captured";
      const belongsToOrder = payment?.order_id === razorpay_order_id;
      const amountMatches =
        Number(payment?.amount) === Number(rzpOrder?.amount);

      if (!captured || !belongsToOrder || !amountMatches) {
        logPaymentEvent({
          userId: req.user._id,
          userEmail: req.body.user_info?.email,
          event: "RAZORPAY_PAYMENT_INVALID",
          amount: req.body.total,
          status: "error",
          errorMessage: `status=${payment?.status} order=${payment?.order_id} amount=${payment?.amount}/${rzpOrder?.amount}`,
          req,
        });
        return res
          .status(400)
          .send({ message: "El pago no pudo verificarse o está incompleto." });
      }
    } catch (verifyErr) {
      logPaymentEvent({
        userId: req.user._id,
        userEmail: req.body.user_info?.email,
        event: "RAZORPAY_VERIFY_ERROR",
        amount: req.body.total,
        status: "error",
        errorMessage: verifyErr.message,
        req,
      });
      return res
        .status(400)
        .send({ message: "No se pudo verificar el pago con Razorpay." });
    }

    // Validar costo de envío
    const shippingError = await validateShippingCost(
      req.body.shippingCost,
      req.body.shippingOption,
      Number(req.body.subTotal) || 0
    );
    if (shippingError) return res.status(400).send({ message: shippingError });

    const { taxRate, taxAmount } = await calculateTax(Number(req.body.total) || 0);

    const newOrder = new Order({
      ...req.body,
      user: req.user._id,
      taxRate,
      taxAmount,
    });
    const order = await newOrder.save();
    res.status(201).send(order);
    handleProductQuantity(order.cart);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// get all orders user
const getOrderCustomer = async (req, res) => {
  try {
    // console.log("getOrderCustomer", req.user);
    const { page, limit } = req.query;

    const pages = Number(page) || 1;
    const limits = Number(limit) || 8;
    const skip = (pages - 1) * limits;

    const userId = new mongoose.Types.ObjectId(req.user._id);

    const totalDoc = await Order.countDocuments({ user: userId });

    // total pedido order count
    const totalPendingOrder = await Order.aggregate([
      {
        $match: {
          status: { $regex: `pedido`, $options: "i" },
          user: userId,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    // total empaquetado order count
    const totalProcessingOrder = await Order.aggregate([
      {
        $match: {
          status: { $regex: `empaquetado`, $options: "i" },
          user: userId,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const totalDeliveredOrder = await Order.aggregate([
      {
        $match: {
          status: { $regex: `entregado`, $options: "i" },
          user: userId,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    // today order amount

    // query for orders
    const orders = await Order.find({ user: req.user._id })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limits);

    res.send({
      orders,
      limits,
      pages,
      pendiente: totalPendingOrder.length === 0 ? 0 : totalPendingOrder[0].count,
      procesando:
        totalProcessingOrder.length === 0 ? 0 : totalProcessingOrder[0].count,
      entregado:
        totalDeliveredOrder.length === 0 ? 0 : totalDeliveredOrder[0].count,

      totalDoc,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    // console.log("getOrderById");
    const order = await Order.findById(req.params.id);
    res.send(order);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const sendEmailInvoiceToCustomer = async (req, res) => {
  try {
    const user = req.body.user_info;
    // Validate email using MailChecker
    // Validate email using MailChecker
    if (!MailChecker.isValid(user?.email)) {
      // Return a response indicating invalid email instead of using process.exit
      return res.status(400).send({
        message:
          "Invalid or disposable email address. Please provide a valid email.",
      });
    }
    // console.log("sendEmailInvoiceToCustomer");
    const pdf = await handleCreateInvoice(req.body, `${req.body.invoice}.pdf`);

    const option = {
      date: req.body.date,
      invoice: req.body.invoice,
      status: req.body.status,
      method: req.body.paymentMethod,
      subTotal: (req.body.cart || []).reduce((acc, item) => acc + ((item.originalPrice || item.price) * item.quantity), 0),
      total: req.body.total,
      discount: req.body.discount,
      shipping: req.body.shippingCost,
      currency: req.body.company_info.currency,
      company_name: req.body.company_info.company,
      company_address: req.body.company_info.address,
      company_phone: req.body.company_info.phone,
      company_email: req.body.company_info.email,
      company_website: req.body.company_info.website,
      vat_number: req.body?.company_info?.vat_number,
      name: user?.name,
      email: user?.email,
      phone: user?.contact,
      address: [
        user?.calle ? `${user.calle} ${user.numExterior || ""}${user.numInterior ? ` Int. ${user.numInterior}` : ""}` : "",
        user?.colonia ? `${user.colonia}, ${user.municipio || ""}` : "",
        user?.postalCode ? `Jalisco, C.P. ${user.postalCode}` : "",
      ].filter(Boolean).join("<br/>"),
      cart: req.body.cart,
    };

    const body = {
      from: CONFIG.EMAIL.FROM,
      to: user.email,
      subject: `Tu Pedido #${req.body.invoice} - ${CONFIG.COMPANY.NAME}`,
      html: customerInvoiceEmailBody(option),
      attachments: [
        {
          filename: `${req.body.invoice}.pdf`,
          content: pdf,
        },
      ],
    };
    const message = `Factura enviada exitosamente al cliente ${user.name}`;
    sendEmail(body, res, message);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrderCustomer,
  createPaymentIntent,
  createOrderByRazorPay,
  addRazorpayOrder,
  sendEmailInvoiceToCustomer,
};
