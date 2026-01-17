// controller/reviewController.js
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const mongoose = require("mongoose");

const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$product",
        average_rating: { $avg: "$rating" },
        total_reviews: { $sum: 1 },
      },
    },
  ]);

  // console.log("result", result, "productId", productId);

  if (result.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      average_rating: result[0].average_rating,
      total_reviews: result[0].total_reviews,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      average_rating: 0,
      total_reviews: 0,
    });
  }
};

const addReview = async (req, res) => {
  try {
    const { product, images, rating, comment } = req.body;
    const user = req.user._id;
    // console.log("addReview", req.body);

    const review = await Review.create({
      product,
      images,
      rating,
      comment,
      user,
    });
    await updateProductRating(product);

    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getUserPurchasedProducts = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { page = 1, limit = 30 } = req.query; // default to 30 so we can split 15/15
    const halfLimit = Math.floor(parseInt(limit) / 2);
    const skipReviewed = (parseInt(page) - 1) * halfLimit;
    const skipNotReviewed = skipReviewed; // same pagination logic for both categories

    // 1️⃣ Get all cart items from entregado/completed orders
    const orders = await Order.find({
      user: userId,
      status: { $regex: /^(entregado|completed)$/i },
    })
      .sort({ createdAt: -1 })
      .lean();

    const allItems = orders.flatMap((order) =>
      order.cart
        .filter((item) => item._id)
        .map((item) => ({
          _id: item._id.toString(),
          title: item.title,
          image: Array.isArray(item.image) ? item.image[0] : item.image,
        }))
    );

    // 2️⃣ Deduplicate by _id
    const uniqueItemsMap = new Map();
    for (const item of allItems) {
      if (!uniqueItemsMap.has(item._id)) {
        uniqueItemsMap.set(item._id, item);
      }
    }
    const uniqueItems = Array.from(uniqueItemsMap.values());

    // 3️⃣ Get user's own reviews
    const productIds = uniqueItems.map((item) => item._id);
    const userReviews = await Review.find({
      user: userId,
      product: { $in: productIds },
    })
      .select("_id product rating comment createdAt")
      .lean();

    const reviewMap = new Map();
    for (const r of userReviews) {
      reviewMap.set(r.product.toString(), r);
    }

    // 4️⃣ Attach review data
    const reviewedList = [];
    const notReviewedList = [];
    for (const item of uniqueItems) {
      const review = reviewMap.get(item._id) || null;
      const fullItem = { ...item, review };
      if (review) reviewedList.push(fullItem);
      else notReviewedList.push(fullItem);
    }

    // 5️⃣ Paginate each category separately
    const paginatedReviewed = reviewedList.slice(
      skipReviewed,
      skipReviewed + halfLimit
    );
    const paginatedNotReviewed = notReviewedList.slice(
      skipNotReviewed,
      skipNotReviewed + halfLimit
    );

    // 6️⃣ Send both categories in one payload
    res.status(200).json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      reviewed: paginatedReviewed,
      notReviewed: paginatedNotReviewed,
      totalReviewed: reviewedList.length,
      totalNotReviewed: notReviewedList.length,
    });
  } catch (error) {
    console.error("Error fetching purchased products:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId }).populate(
      "user",
      "name"
    );
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { rating, images, comment, reviewId } = req.body;
    const user = req.user._id;

    const review = await Review.findOneAndUpdate(
      { _id: reviewId, user },
      { rating, comment, images },
      { new: true }
    );

    // console.log("updateReview", review);

    if (!review) return res.status(404).json({ error: "Review not found" });

    await updateProductRating(review.product);
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user._id;

    const review = await Review.findOneAndDelete({ _id: id, user });

    if (!review) return res.status(404).json({ error: "Review not found" });

    await updateProductRating(review.product);
    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserPurchasedProducts,
};
