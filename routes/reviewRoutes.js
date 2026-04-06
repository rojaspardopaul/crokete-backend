// routes/reviewRoutes.js
const {
  addReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserPurchasedProducts,
  toggleHelpful,
  getAdminReviews,
  approveReview,
  rejectReview,
  getReviewStats,
} = require("../controller/reviewController");
const { isSuperAdmin } = require("../config/auth");

const express = require("express");
const router = express.Router();

// ── Admin routes (must be before :productId param) ──────────────────────────
router.get("/admin", isSuperAdmin, getAdminReviews);
router.get("/stats", isSuperAdmin, getReviewStats);
router.put("/:id/approve", isSuperAdmin, approveReview);
router.put("/:id/reject", isSuperAdmin, rejectReview);

// ── Customer routes ─────────────────────────────────────────────────────────
router.post("/", addReview);
router.get("/purchased-products", getUserPurchasedProducts);
router.put("/:id/helpful", toggleHelpful);
router.get("/:productId", getReviewsByProduct);
router.put("/", updateReview);
router.delete("/:id", deleteReview);

module.exports = router;
