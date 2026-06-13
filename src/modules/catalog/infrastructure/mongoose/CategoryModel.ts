import mongoose, { Schema, type Model } from "mongoose";

/**
 * Minimal Category model used only by the catalog read side (subtree filtering).
 * Guarded against double-registration.
 */
const categorySchema = new Schema(
  {
    name: { type: Object, required: true },
    slug: { type: String },
    parentId: { type: String },
    status: { type: String, enum: ["show", "hide"], default: "show" },
  },
  { timestamps: true }
);

export type CategoryDocument = mongoose.InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CategoryModel: Model<CategoryDocument> =
  (mongoose.models.Category as Model<CategoryDocument>) ??
  mongoose.model<CategoryDocument>("Category", categorySchema);
