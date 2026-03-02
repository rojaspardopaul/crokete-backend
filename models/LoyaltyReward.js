const mongoose = require("mongoose");

const loyaltyRewardSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["milestone", "points_redemption"],
      required: true,
    },
    couponCode: {
      type: String,
      required: true,
      unique: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minimumAmount: {
      type: Number,
      default: 0,
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      required: false,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false, // set when the reward is used
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    pointsSpent: {
      type: Number,
      default: 0, // only for points_redemption type
    },
  },
  {
    timestamps: true,
  }
);

loyaltyRewardSchema.index({ customer: 1, used: 1 });

const LoyaltyReward = mongoose.model("LoyaltyReward", loyaltyRewardSchema);
module.exports = LoyaltyReward;
