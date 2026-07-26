require("dotenv").config();
const stripe = require("stripe");
const { logPaymentEvent } = require("../utils/paymentLogger");
const { getStripeConfig } = require("../utils/getConfig");

/**
 * Stripe webhook handler.
 * Verifies the event signature and logs payment events.
 * Endpoint must use express.raw() body parser (not JSON).
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;
  try {
    const { secretKey } = await getStripeConfig();
    const stripeInstance = stripe(secretKey);
    event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const paymentIntent = event.data?.object;

  switch (event.type) {
    case "payment_intent.succeeded":
      logPaymentEvent({
        event: "PAYMENT_SUCCEEDED",
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: "success",
        metadata: {
          webhookEventId: event.id,
          receiptEmail: paymentIntent.receipt_email,
        },
      });
      break;

    case "payment_intent.payment_failed":
      logPaymentEvent({
        event: "PAYMENT_FAILED",
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: "error",
        errorMessage:
          paymentIntent.last_payment_error?.message || "Payment failed",
        metadata: {
          webhookEventId: event.id,
          failureCode: paymentIntent.last_payment_error?.code,
        },
      });
      break;

    case "charge.refunded": {
      const charge = event.data.object;
      logPaymentEvent({
        event: "REFUND_INITIATED",
        stripePaymentIntentId: charge.payment_intent,
        amount: charge.amount_refunded / 100,
        currency: charge.currency,
        status: "success",
        metadata: {
          webhookEventId: event.id,
          chargeId: charge.id,
        },
      });
      break;
    }

    default:
      // Log unexpected events for visibility
      logPaymentEvent({
        event: "WEBHOOK_RECEIVED",
        status: "success",
        metadata: {
          webhookEventId: event.id,
          eventType: event.type,
        },
      });
  }

  res.json({ received: true });
};

module.exports = { handleStripeWebhook };
