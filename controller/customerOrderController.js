require("dotenv").config();
const stripe = require("stripe");
const MailChecker = require("mailchecker");
const CONFIG = require("../config");

const { sendEmail, sendEmailAsync } = require("../lib/email-sender/sender");
const { formatAmountForStripe } = require("../lib/stripe/stripe");
const { handleCreateInvoice } = require("../lib/email-sender/create");
const { handleProductQuantity } = require("../lib/stock-controller/others");
const customerInvoiceEmailBody = require("../lib/email-sender/templates/order-to-customer");
const orderConfirmedEmailBody = require("../lib/email-sender/templates/order-to-customer/order-confirmed");
const { logPaymentEvent } = require("../utils/paymentLogger");
const { getStripeConfig } = require("../utils/getConfig");
const { readSetting } = require("../lib/prisma/settings");
const { getPrisma } = require("../lib/prisma");
const { orderToApi } = require("../lib/prisma/presenters");
const { isUuid, fail, notFound } = require("../lib/prisma/helpers");

const orders = () => getPrisma().order;

/**
 * Calcula el IVA incluido en el total (precio con IVA incluido).
 * taxAmount = total × taxRate / (100 + taxRate)
 */
const calculateTax = async (total) => {
  const globalSetting = await readSetting("globalSetting");
  const taxRate = Number(globalSetting?.tax_rate) || 16;
  const taxAmount = Math.round((total * taxRate / (100 + taxRate)) * 100) / 100;
  return { taxRate, taxAmount };
};

/**
 * Valida el costo de envío contra las tarifas configuradas en la DB.
 * Devuelve null si es válido, o un mensaje de error si no.
 */
const validateShippingCost = async (shippingCost, shippingOption, cartTotal) => {
  const s = (await readSetting("globalSetting")) || {};

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

/**
 * Carrito de la tienda → filas de `order_items`.
 *
 * En Mongo el carrito era un array de documentos libres dentro del pedido. Aquí
 * cada línea es una fila: los campos que se consultan y agregan pasan a
 * columnas y el ítem original se guarda íntegro en `snapshot`, que es lo que la
 * factura y el detalle del pedido siguen leyendo.
 *
 * El id del producto es `_id`; `id` es el identificador del carrito de la
 * tienda, que en los productos con variante vale "<productId>-<variantId>" y
 * por tanto no es un uuid.
 */
const cartToItems = (cart) =>
  (Array.isArray(cart) ? cart : []).map((item) => {
    const productId = [item?._id, item?.id].find(isUuid) || null;
    const variantId = [item?.variant?._id, item?.variant?.id].find(isUuid) || null;
    const price = Number(item?.price) || 0;
    const quantity = Number(item?.quantity) || 0;
    const image = Array.isArray(item?.image) ? item.image[0] : item?.image;

    return {
      productId,
      variantId,
      title: String(item?.title ?? ""),
      image: image || null,
      sku: item?.sku || null,
      price,
      quantity,
      itemTotal: Number(item?.itemTotal ?? price * quantity) || 0,
      snapshot: item ?? {},
    };
  });

/** Campos del pedido aceptados desde el cliente (el resto del body se ignora). */
const orderDataFromBody = (body, { customerId, taxRate, taxAmount, stripePaymentIntentId = null }) => ({
  customerId,
  userInfo: body.user_info ?? {},
  subTotal: Number(body.subTotal) || 0,
  shippingCost: Number(body.shippingCost) || 0,
  discount: Number(body.discount) || 0,
  taxRate,
  taxAmount,
  total: Number(body.total) || 0,
  shippingOption: body.shippingOption || null,
  paymentMethod: body.paymentMethod,
  stripePaymentIntentId,
  loyaltyCouponCode: body.loyaltyCouponCode || null,
  cardInfo: body.cardInfo ?? undefined,
  status: "pedido",
  items: { create: cartToItems(body.cart) },
});

/** Violación de índice único en Postgres (pedido duplicado por PaymentIntent). */
const isUniqueViolation = (err) => err?.code === "P2002";

const addOrder = async (req, res) => {
  try {
    const { paymentMethod, total, subTotal, shippingCost, shippingOption, cart } = req.body;

    if (!isUuid(req.user?._id)) {
      return res.status(401).send({
        message: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
      });
    }

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
      const existing = await orders().findUnique({
        where: { stripePaymentIntentId },
        include: { items: true },
      });
      if (existing) {
        return res.status(200).send(orderToApi(existing));
      }
    }

    const { taxRate, taxAmount } = await calculateTax(Number(total));

    // El folio ya no se calcula leyendo el último pedido (dos compras
    // simultáneas podían obtener el mismo número): lo asigna la secuencia
    // nativa de Postgres.
    let created;
    try {
      created = await orders().create({
        data: orderDataFromBody(req.body, {
          customerId: req.user._id,
          taxRate,
          taxAmount,
          stripePaymentIntentId,
        }),
        include: { items: true },
      });
    } catch (saveErr) {
      // Índice único sobre stripePaymentIntentId — el pedido ya existe (carrera)
      if (isUniqueViolation(saveErr) && stripePaymentIntentId) {
        const existing = await orders().findUnique({
          where: { stripePaymentIntentId },
          include: { items: true },
        });
        if (existing) return res.status(200).send(orderToApi(existing));
      }
      throw saveErr;
    }

    const order = orderToApi(created);

    logPaymentEvent({
      orderId: created.id,
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
    // Se descuenta con el carrito tal como llegó: `_id` es el uuid del producto,
    // mientras que en las líneas ya guardadas `_id` es el de la propia línea.
    handleProductQuantity(cart);

    // Fire-and-forget order confirmation email
    (async () => {
      try {
        const setting = await readSetting("storeSetting");
        const currency = setting?.default_currency || "$";
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
  // Validate the amount that was passed from the client.
  const min = Number(process.env.MIN_AMOUNT) || 1;
  const max = Number(process.env.MAX_AMOUNT) || 1_000_000;
  if (amount < min || amount > max) {
    return res.status(500).json({ message: "Monto no válido." });
  }

  const stripeConfig = await getStripeConfig();
  const { secretKey } = stripeConfig;
  if (!secretKey) {
    console.error("❌ Stripe secret key not configured. Set STRIPE_SECRET in .env or stripe_secret in Store Settings");
    return res.status(500).json({ message: "Stripe no está configurado. Contacta al administrador." });
  }

  // El intento de pago se crea aquí con la clave secreta, pero lo confirma el
  // navegador con la pública de `storeSetting`. Si son de cuentas distintas, el
  // pago moría a mitad con un `resource_missing` que sólo veía el cliente: el
  // backend respondía 200 y no quedaba rastro del fallo. Se corta antes.
  if (!stripeConfig.accountsMatch) {
    const detalle =
      `clave secreta de la cuenta ${stripeConfig.secretAccount} (${stripeConfig.secretMode}, origen ${stripeConfig.source}) ` +
      `pero la tienda cobra con la pública de ${stripeConfig.storeAccount} (${stripeConfig.storeMode})`;
    console.error(`❌ Stripe: claves de cuentas distintas — ${detalle}`);

    logPaymentEvent({
      userId: req.user?._id,
      userEmail: email,
      event: "PAYMENT_FAILED",
      amount,
      status: "error",
      errorMessage: `Configuración inválida: ${detalle}`,
      req,
    });

    return res.status(503).json({
      message:
        "El cobro con tarjeta no está disponible en este momento. Por favor, elige pago contra entrega o inténtalo más tarde.",
    });
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

// get all orders user
const getOrderCustomer = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const pages = Number(page) || 1;
    const limits = Number(limit) || 8;
    const skip = (pages - 1) * limits;

    if (!isUuid(req.user?._id)) {
      return res.status(401).send({
        message: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
      });
    }
    const where = { customerId: req.user._id };

    const countByStatus = (status) =>
      orders().count({ where: { ...where, status } });

    const [totalDoc, pendiente, procesando, entregado, rows] = await Promise.all([
      orders().count({ where }),
      countByStatus("pedido"),
      countByStatus("empaquetado"),
      countByStatus("entregado"),
      orders().findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limits,
      }),
    ]);

    res.send({
      orders: rows.map(orderToApi),
      limits,
      pages,
      pendiente,
      procesando,
      entregado,
      totalDoc,
    });
  } catch (err) {
    fail(res, err);
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Pedido no encontrado");

    const order = await orders().findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) return notFound(res, "Pedido no encontrado");

    // El pedido sólo lo ve su dueño: antes bastaba con conocer el id para leer
    // los datos de contacto y envío de cualquier cliente.
    if (order.customerId !== req.user?._id) {
      return notFound(res, "Pedido no encontrado");
    }

    res.send(orderToApi(order));
  } catch (err) {
    fail(res, err);
  }
};

const sendEmailInvoiceToCustomer = async (req, res) => {
  try {
    const user = req.body.user_info;
    // Validate email using MailChecker
    if (!MailChecker.isValid(user?.email)) {
      // Return a response indicating invalid email instead of using process.exit
      return res.status(400).send({
        message:
          "Invalid or disposable email address. Please provide a valid email.",
      });
    }
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
  sendEmailInvoiceToCustomer,
};
