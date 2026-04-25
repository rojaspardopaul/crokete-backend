const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    invoice: {
      type: Number,
      required: false,
    },
    cart: [{}], // <-- Use Mixed for nested objects
    user_info: {
      name: String,
      email: String,
      contact: String,
      postalCode: String,
      colonia: String,
      calle: String,
      numExterior: String,
      numInterior: String,
      municipio: String,
      referencias: String,
      estado: String,
      pais: String,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      required: true,
    },
    discount: { type: Number, default: 0 },

    total: {
      type: Number,
      required: true,
    },
    shippingOption: {
      type: String,
      required: false,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    loyaltyCouponCode: {
      type: String,
      default: null,
    },
    cardInfo: {
      type: Object,
      required: false,
    },
    status: {
      type: String,
      enum: ["pedido", "empaquetado", "en_reparto", "entregado", "cancelado"],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate orders for the same Stripe PaymentIntent
orderSchema.index({ stripePaymentIntentId: 1 }, { unique: true, sparse: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
