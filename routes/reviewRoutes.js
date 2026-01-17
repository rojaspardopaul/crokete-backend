// routes/reviewRoutes.js
const {
  addReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserPurchasedProducts,
} = require("../controller/reviewController");

const express = require("express");
const router = express.Router();

// ✅ Static and specific routes first
router.post("/", addReview); // requires { product, rating, comment }
//purchased products
router.get("/purchased-products", getUserPurchasedProducts);
router.get("/:productId", getReviewsByProduct); // list all reviews for a product

// ✅ Then dynamic routes
router.put("/", updateReview); // update own review
router.delete("/:id", deleteReview); // delete own review

module.exports = router;
