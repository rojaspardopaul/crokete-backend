import mongoose, { Schema, type Model } from "mongoose";

/**
 * Mongoose model for the `orders` collection. In the integrated app the legacy
 * models/Order.js (which adds the mongoose-sequence invoice auto-increment)
 * registers first, so this guard reuses it. Standalone (tests) it registers a
 * compatible schema. The admin module only reads/updates/deletes — it never
 * creates orders — so the auto-increment plugin is not needed here.
 */
const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    invoice: { type: Number },
    cart: [{}],
    user_info: { type: Object },
    subTotal: { type: Number },
    shippingCost: { type: Number },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 16 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number },
    shippingOption: { type: String },
    paymentMethod: { type: String },
    stripePaymentIntentId: { type: String, default: null },
    loyaltyCouponCode: { type: String, default: null },
    cardInfo: { type: Object },
    paid: { type: Boolean },
    status: {
      type: String,
      enum: ["pedido", "empaquetado", "en_reparto", "entregado", "cancelado"],
    },
  },
  { timestamps: true }
);

export const OrderModel: Model<Record<string, unknown>> =
  (mongoose.models.Order as Model<Record<string, unknown>>) ??
  mongoose.model("Order", orderSchema);
