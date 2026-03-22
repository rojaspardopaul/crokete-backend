const mongoose = require("mongoose");

const durationOptionSchema = new mongoose.Schema(
  {
    minutes: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true, // e.g. "15 minutos", "30 minutos"
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const discountTierSchema = new mongoose.Schema(
  {
    minSpent: {
      type: Number,
      required: true,
    },
    discountPercent: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true, // e.g. "Cliente Frecuente - 10%"
    },
  },
  { _id: true }
);

const vetConfigSchema = new mongoose.Schema(
  {
    // Feature toggle — master switch
    enabled: {
      type: Boolean,
      default: false, // Disabled by default
    },

    // Duration options
    durations: [durationOptionSchema],

    // Discount tiers based on customer totalSpent
    discountTiers: [discountTierSchema],

    // Threshold for 100% free consultation
    freeThreshold: {
      type: Number,
      default: 0, // 0 = disabled (no free consultations)
    },

    // Scheduling config
    advanceBookingDays: {
      type: Number,
      default: 30, // How far in advance customers can book
    },
    minBookingHoursAhead: {
      type: Number,
      default: 24, // Must book at least 24h ahead
    },

    // Video platform preference
    videoPlatform: {
      type: String,
      enum: ["google_meet", "jitsi"],
      default: "jitsi",
    },

    // Working hours (default schedule)
    workingHours: {
      start: { type: String, default: "09:00" }, // HH:mm
      end: { type: String, default: "18:00" },
    },

    // Days of week available (0=Sunday, 6=Saturday)
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday to Friday
    },

    // Cancellation policy
    cancellationHoursLimit: {
      type: Number,
      default: 12, // Can cancel up to 12h before
    },

    // Max consultations per day (across all vets)
    maxDailyConsultations: {
      type: Number,
      default: 20,
    },

    // Terms / instructions shown to customers
    customerInstructions: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const VetConfig = mongoose.model("VetConfig", vetConfigSchema);
module.exports = VetConfig;
