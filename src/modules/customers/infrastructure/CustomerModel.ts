import mongoose, { Schema, type Model } from "mongoose";

/**
 * Mongoose model for the `customers` collection. In the integrated app the
 * legacy models/Customer.js registers first and this guard reuses it; standalone
 * (tests) it registers a compatible schema. shippingAddress is a single embedded
 * object (not an array), matching the legacy schema.
 */
const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    image: { type: String },
    address: { type: String },
    country: { type: String },
    city: { type: String },
    shippingAddress: { type: Object },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    password: { type: String },
    loyalty: { type: Object },
  },
  { timestamps: true }
);

export const CustomerModel: Model<Record<string, unknown>> =
  (mongoose.models.Customer as Model<Record<string, unknown>>) ??
  mongoose.model("Customer", customerSchema);
