const express = require("express");
const router = express.Router();
const {
  handleStripeWebhook,
} = require("../controller/stripeWebhookController");

// Stripe sends raw body — must use express.raw() instead of express.json()
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

module.exports = router;
