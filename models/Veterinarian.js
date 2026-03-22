const mongoose = require("mongoose");

const availabilitySlotSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number, // 0=Sunday, 6=Saturday
      required: true,
    },
    start: {
      type: String, // HH:mm
      required: true,
    },
    end: {
      type: String, // HH:mm
      required: true,
    },
  },
  { _id: true }
);

const veterinarianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: false,
    },
    specialties: {
      type: [String],
      default: [], // e.g. ["dermatología", "nutrición", "comportamiento"]
    },
    image: {
      type: String,
      required: false,
    },
    bio: {
      type: String,
      default: "",
    },
    licenseNumber: {
      type: String,
      required: false, // Cédula profesional
    },

    // Custom availability (overrides global working hours)
    availability: [availabilitySlotSchema],

    // Whether this vet is currently active
    status: {
      type: String,
      lowercase: true,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

veterinarianSchema.index({ status: 1 });

const Veterinarian = mongoose.model("Veterinarian", veterinarianSchema);
module.exports = Veterinarian;
