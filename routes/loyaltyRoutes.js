const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");
const {
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
} = require("../controller/loyaltyController");

// ==========================================
// Customer endpoints (isAuth applied at route registration)
// ==========================================

// Get my loyalty summary
router.get("/my", getMyLoyalty);

// Get my point history
router.get("/history", getPointHistory);

// Get my available rewards
router.get("/rewards", getAvailableRewards);

// Redeem points for a coupon
router.post("/redeem", redeemPoints);

// Validate a reward coupon for checkout
router.post("/apply-reward", applyReward);

// Mark reward as used after checkout
router.post("/use-reward", useReward);

// ==========================================
// Admin endpoints
// ==========================================

// Get loyalty config
router.get("/config", isAdmin, getLoyaltyConfig);

// Update loyalty config
router.put("/config", isAdmin, updateLoyaltyConfig);

// Get a specific customer's loyalty data (admin)
router.get("/admin/customer/:id", isAdmin, getCustomerLoyaltyAdmin);

// Get all customers with loyalty data (admin)
router.get("/admin/customers", isAdmin, getAllCustomersLoyalty);

// Manual point adjustment (admin)
router.post("/admin/adjust", isAdmin, adjustPoints);

module.exports = router;
