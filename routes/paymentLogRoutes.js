const express = require("express");
const router = express.Router();
const {
  getPaymentLogs,
  getPaymentLogsByOrder,
} = require("../controller/paymentLogController");

// Get all payment logs with filters and pagination
router.get("/", getPaymentLogs);

// Get payment logs for a specific order
router.get("/order/:orderId", getPaymentLogsByOrder);

module.exports = router;
