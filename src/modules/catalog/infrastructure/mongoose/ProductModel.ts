import mongoose, { Schema, type Model } from "mongoose";

/**
 * Mongoose schema for the `products` collection — the TypeScript port of the
 * legacy models/Product.js. The DDD layers never import this directly; only the
 * mapper and repository do. Keeping it here isolates persistence concerns.
 *
 * NOTE: `mongoose.models.Product` guard avoids OverwriteModelError if the model
 * is registered twice in the same process.
 */
const multiLang = { type: Object } as const;

const productSchema = new Schema(
  {
    productId: { type: String, required: false },
    sku: { type: String, required: false },
    barcode: { type: String, required: false },
    title: { type: Object, required: true },
    description: { type: Object, required: false },
    slug: { type: String, required: true },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    pet: { type: Schema.Types.ObjectId, ref: "Pet", required: false },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: false },
    image: { type: Array, required: false },
    stock: { type: Number, required: false, min: 0 },
    sales: { type: Number, required: false },
    tag: [String],
    prices: {
      originalPrice: { type: Number, required: true },
      price: { type: Number, required: true },
      discount: { type: Number, required: false },
    },
    variants: [{}],
    isCombination: { type: Boolean, required: true },
    average_rating: { type: Number, default: 0 },
    total_reviews: { type: Number, default: 0 },
    status: { type: String, default: "show", enum: ["show", "hide"] },
    productType: {
      type: String,
      enum: ["food", "medicine", "accessory", "general"],
      default: "general",
    },
    petCompatibility: {
      petType: { type: [String], default: [] },
      ageRange: { type: [String], default: [] },
      size: { type: [String], default: [] },
      breed: { type: [String], default: [] },
      specialNeeds: { type: [String], default: [] },
    },
    quickInfo: {
      pet: { type: String },
      age: { type: String },
      size: { type: String },
      weightRange: { type: String },
      highlight: { type: String },
    },
    packageInfo: {
      weight: { type: Number },
      unit: { type: String, enum: ["kg", "g", "mg", "l", "ml", "lb", "oz", "pieza"] },
      servings: { type: Number },
    },
    benefits: multiLang,
    features: multiLang,
    ingredients: multiLang,
    feedingGuide: multiLang,
    indications: multiLang,
    warnings: multiLang,
    dosage: multiLang,
    recommendedFor: multiLang,
    brandInfo: multiLang,
    nutritionTable: {
      guaranteedAnalysis: [
        { nutrient: { type: String }, value: { type: String }, unit: { type: String } },
      ],
      calories: { type: String },
      caloriesPerKg: { type: Number },
    },
    technicalSpecs: [{ key: { type: Object }, value: { type: Object } }],
    consumptionGuide: [
      { petWeight: { type: Number }, dailyAmount: { type: Number }, durationDays: { type: Number } },
    ],
    productHighlights: { type: [String], default: [] },
    keyFacts: [{ label: { type: String }, value: { type: String } }],
    visualTags: { type: [String], default: [] },
    iconTags: { type: [String], default: [] },
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, categories: 1 });
productSchema.index({ status: 1, sales: -1 });
productSchema.index({ status: 1, "prices.originalPrice": 1 });
productSchema.index({ productType: 1, status: 1 });
productSchema.index({ "petCompatibility.petType": 1, status: 1 });

export type ProductDocument = mongoose.InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProductModel: Model<ProductDocument> =
  (mongoose.models.Product as Model<ProductDocument>) ??
  mongoose.model<ProductDocument>("Product", productSchema);
