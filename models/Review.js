const mongoose = require("mongoose");

const aiAnalysisSchema = new mongoose.Schema(
  {
    confidence: { type: Number, default: 0 },
    suggestedAction: {
      type: String,
      enum: [
        "approved_suggestion",
        "needs_review",
        "spam",
        "offensive",
        "fake_review",
      ],
      default: "needs_review",
    },
    reason: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    title: {
      type: String,
      maxlength: 100,
      default: "",
    },
    comment: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 1000,
    },
    displayName: {
      type: String,
      maxlength: 50,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    aiAnalysis: {
      type: aiAnalysisSchema,
      default: () => ({}),
    },
    adminNote: {
      type: String,
      default: "",
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ product: 1, status: 1 });

module.exports = mongoose.model("Review", reviewSchema);
