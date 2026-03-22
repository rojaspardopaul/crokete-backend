const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },

    shippingAddress: {
      name: { type: String },
      contact: { type: String },
      email: { type: String },
      postalCode: { type: String },
      colonia: { type: String },
      calle: { type: String },
      numExterior: { type: String },
      numInterior: { type: String },
      municipio: { type: String },
      referencias: { type: String },
      estado: { type: String },
      pais: { type: String },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },

    // Loyalty program
    loyalty: {
      points: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 }, // lifetime earned
      totalSpent: { type: Number, default: 0 }, // lifetime $ spent
      orderCount: { type: Number, default: 0 },
      tier: {
        type: String,
        enum: ["nuevo", "frecuente", "vip"],
        default: "nuevo",
      },
      joinedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
