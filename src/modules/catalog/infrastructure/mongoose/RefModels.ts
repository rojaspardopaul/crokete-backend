import mongoose, { Schema, type Model } from "mongoose";

/**
 * Minimal, non-strict models for collections the catalog read side only needs
 * to populate/search against (Brand, Pet, Review). Guarded against
 * double-registration. The owning bounded contexts define the full schemas.
 */
function lenientModel(name: string): Model<Record<string, unknown>> {
  return (
    (mongoose.models[name] as Model<Record<string, unknown>>) ??
    mongoose.model(name, new Schema({}, { strict: false, timestamps: true }))
  );
}

export const BrandModel = lenientModel("Brand");
export const PetModel = lenientModel("Pet");
export const ReviewModel = lenientModel("Review");
