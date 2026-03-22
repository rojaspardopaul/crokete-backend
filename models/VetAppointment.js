const mongoose = require("mongoose");

const vetAppointmentSchema = new mongoose.Schema(
  {
    // References
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    veterinarian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Veterinarian",
      required: true,
      index: true,
    },
    customerPet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerPet",
      required: true,
    },

    // Scheduling
    date: {
      type: Date,
      required: true,
      index: true,
    },
    duration: {
      type: Number, // minutes
      required: true,
    },

    // Reason / symptoms
    reason: {
      type: String,
      required: true,
    },
    symptoms: {
      type: [String],
      default: [],
    },

    // Pricing
    originalPrice: {
      type: Number,
      required: true,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
    },

    // Status workflow: requested → approved → confirmed → completed
    // Also: rejected, cancelled, no_show
    status: {
      type: String,
      enum: [
        "requested",   // Customer submitted request
        "approved",    // Admin/vet approved
        "confirmed",   // Payment confirmed or free
        "in_progress", // Consultation happening
        "completed",   // Consultation done
        "rejected",    // Admin/vet rejected
        "cancelled",   // Customer or admin cancelled
        "no_show",     // Customer didn't show up
      ],
      default: "requested",
    },

    // Video call info
    meetingUrl: {
      type: String,
      default: "",
    },
    meetingPlatform: {
      type: String,
      enum: ["google_meet", "jitsi"],
      default: "jitsi",
    },

    // Admin/vet notes
    adminNotes: {
      type: String,
      default: "",
    },

    // Vet clinical notes (after consultation)
    clinicalNotes: {
      type: String,
      default: "",
    },
    diagnosis: {
      type: String,
      default: "",
    },
    recommendations: {
      type: String,
      default: "",
    },

    // Cancellation info
    cancelledBy: {
      type: String,
      enum: ["customer", "admin", "vet", null],
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
    },

    // Status history for audit trail
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: String, // "customer", "admin", "system"
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

vetAppointmentSchema.index({ date: 1, veterinarian: 1 });
vetAppointmentSchema.index({ customer: 1, status: 1 });
vetAppointmentSchema.index({ status: 1, date: 1 });

const VetAppointment = mongoose.model("VetAppointment", vetAppointmentSchema);
module.exports = VetAppointment;
