const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    orderCount: {
      type: Number,
      required: true,
    },
    discountPercent: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
  },
  { _id: true }
);

const loyaltyConfigSchema = new mongoose.Schema(
  {
    // Points configuration
    pointsPerDollar: {
      type: Number,
      default: 1,
    },
    pointValue: {
      type: Number,
      default: 0.1, // Each point = $0.10 MXN discount
    },
    pointsExpireDays: {
      type: Number,
      default: 365,
    },
    minRedeemPoints: {
      type: Number,
      default: 100,
    },
    maxRedeemPercent: {
      type: Number,
      default: 50, // Max % of order that can be paid with points
    },

    // Milestone rewards
    milestones: [milestoneSchema],

    // Tier thresholds (based on orderCount)
    tierThresholds: {
      frecuente: { type: Number, default: 3 },
      vip: { type: Number, default: 10 },
    },

    // Feature toggle
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const LoyaltyConfig = mongoose.model("LoyaltyConfig", loyaltyConfigSchema);
module.exports = LoyaltyConfig;
