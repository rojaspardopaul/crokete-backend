// controller/reviewController.js
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const { moderateReview, AUTO_APPROVE_THRESHOLD } = require("../lib/ai/reviewModerator");
const { invalidateReviews } = require("../lib/cache/invalidation");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recalculate product average_rating and total_reviews using ONLY approved reviews.
 */
const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$product",
        average_rating: { $avg: "$rating" },
        total_reviews: { $sum: 1 },
      },
    },
  ]);

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

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Customer-facing ─────────────────────────────────────────────────────────

const addReview = async (req, res) => {
  try {
    const { product, images, rating, comment, title, displayName } = req.body;
    const user = req.user._id;

    const review = await Review.create({
      product,
      images: (images || []).slice(0, 5),
      rating,
      comment,
      title: (title || "").slice(0, 100),
      displayName: (displayName || "").slice(0, 50),
      user,
      status: "pending",
    });

    // AI moderation — async, never blocks creation
    let productName = "";
    try {
      const prod = await Product.findById(product).select("title").lean();
      productName = prod?.title?.es || prod?.title?.en || "";
    } catch (_) { /* ignore */ }

    moderateReview({ title, comment, rating, productName })
      .then(async (aiResult) => {
        const update = { aiAnalysis: aiResult };

        // Auto-approve if AI is highly confident it's legitimate
        if (
          aiResult.suggestedAction === "approved_suggestion" &&
          aiResult.confidence >= AUTO_APPROVE_THRESHOLD
        ) {
          update.status = "approved";
        }

        await Review.findByIdAndUpdate(review._id, update);

        // Recalculate if auto-approved
        if (update.status === "approved") {
          await updateProductRating(product);
          invalidateReviews();
        }
      })
      .catch((err) => {
        console.error("⚠️ AI moderation background error:", err.message);
      });

    invalidateReviews();
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getUserPurchasedProducts = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { page = 1, limit = 30 } = req.query;
    const halfLimit = Math.floor(parseInt(limit) / 2);
    const skipReviewed = (parseInt(page) - 1) * halfLimit;
    const skipNotReviewed = skipReviewed;

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

    const uniqueItemsMap = new Map();
    for (const item of allItems) {
      if (!uniqueItemsMap.has(item._id)) {
        uniqueItemsMap.set(item._id, item);
      }
    }
    const uniqueItems = Array.from(uniqueItemsMap.values());

    const productIds = uniqueItems.map((item) => item._id);
    const userReviews = await Review.find({
      user: userId,
      product: { $in: productIds },
    })
      .select("_id product rating comment title displayName status createdAt")
      .lean();

    const reviewMap = new Map();
    for (const r of userReviews) {
      reviewMap.set(r.product.toString(), r);
    }

    const reviewedList = [];
    const notReviewedList = [];
    for (const item of uniqueItems) {
      const review = reviewMap.get(item._id) || null;
      const fullItem = { ...item, review };
      if (review) reviewedList.push(fullItem);
      else notReviewedList.push(fullItem);
    }

    res.status(200).json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      reviewed: reviewedList.slice(skipReviewed, skipReviewed + halfLimit),
      notReviewed: notReviewedList.slice(skipNotReviewed, skipNotReviewed + halfLimit),
      totalReviewed: reviewedList.length,
      totalNotReviewed: notReviewedList.length,
    });
  } catch (error) {
    console.error("Error fetching purchased products:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Public endpoint — returns ONLY approved reviews for a product.
 */
const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({
      product: productId,
      status: "approved",
    })
      .populate("user", "name image")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { rating, images, comment, reviewId, title, displayName } = req.body;
    const user = req.user._id;

    const review = await Review.findOneAndUpdate(
      { _id: reviewId, user },
      {
        rating,
        comment,
        title: (title || "").slice(0, 100),
        displayName: (displayName || "").slice(0, 50),
        images: (images || []).slice(0, 5),
        status: "pending", // re-queue for moderation
        aiAnalysis: undefined, // clear old analysis
      },
      { new: true }
    );

    if (!review) return res.status(404).json({ error: "Review not found" });

    // Re-run AI moderation in background
    let productName = "";
    try {
      const prod = await Product.findById(review.product).select("title").lean();
      productName = prod?.title?.es || prod?.title?.en || "";
    } catch (_) { /* ignore */ }

    moderateReview({ title, comment, rating, productName })
      .then(async (aiResult) => {
        const update = { aiAnalysis: aiResult };
        if (
          aiResult.suggestedAction === "approved_suggestion" &&
          aiResult.confidence >= AUTO_APPROVE_THRESHOLD
        ) {
          update.status = "approved";
        }
        await Review.findByIdAndUpdate(review._id, update);
        if (update.status === "approved") {
          await updateProductRating(review.product);
        }
        invalidateReviews();
      })
      .catch(() => {});

    await updateProductRating(review.product);
    invalidateReviews();
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
    invalidateReviews();
    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndUpdate(
      id,
      { $inc: { helpfulVotes: 1 } },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json({ helpfulVotes: review.helpfulVotes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * Paginated review list with filters for admin moderation panel.
 */
const getAdminReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      rating,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }
    if (rating) {
      filter.rating = parseInt(rating);
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { comment: regex },
        { title: regex },
        { displayName: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [reviews, totalDoc] = await Promise.all([
      Review.find(filter)
        .populate("user", "name email image")
        .populate("product", "title image slug")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      reviews,
      totalDoc,
      limits: limitNum,
      pages: Math.ceil(totalDoc / limitNum),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const review = await Review.findByIdAndUpdate(
      id,
      {
        status: "approved",
        ...(adminNote !== undefined && { adminNote }),
      },
      { new: true }
    );

    if (!review) return res.status(404).json({ error: "Review not found" });

    await updateProductRating(review.product);
    invalidateReviews();
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rejectReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const review = await Review.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        ...(adminNote && { adminNote }),
      },
      { new: true }
    );

    if (!review) return res.status(404).json({ error: "Review not found" });

    await updateProductRating(review.product);
    invalidateReviews();
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Review statistics for admin dashboard.
 */
const getReviewStats = async (req, res) => {
  try {
    const [statusCounts, ratingDistribution, recentPending] = await Promise.all([
      Review.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Review.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
      Review.countDocuments({ status: "pending" }),
    ]);

    const byStatus = {};
    for (const s of statusCounts) {
      byStatus[s._id] = s.count;
    }

    const byRating = {};
    for (const r of ratingDistribution) {
      byRating[r._id] = r.count;
    }

    res.json({
      byStatus: {
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
      },
      byRating,
      recentPending,
      total: (byStatus.pending || 0) + (byStatus.approved || 0) + (byStatus.rejected || 0),
    });
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
  toggleHelpful,
  getAdminReviews,
  approveReview,
  rejectReview,
  getReviewStats,
};
