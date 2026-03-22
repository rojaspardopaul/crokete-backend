const mongoose = require("mongoose");

const customerPetSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    species: {
      type: String,
      enum: ["perro", "gato", "otro"],
      required: true,
    },
    breed: {
      type: String,
      default: "",
    },
    age: {
      type: Number, // in months
      required: false,
    },
    weight: {
      type: Number, // in kg
      required: false,
    },
    gender: {
      type: String,
      enum: ["macho", "hembra"],
      required: false,
    },
    image: {
      type: String,
      required: false,
    },
    notes: {
      type: String,
      default: "", // allergies, conditions, etc.
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

customerPetSchema.index({ customer: 1, status: 1 });

const CustomerPet = mongoose.model("CustomerPet", customerPetSchema);
module.exports = CustomerPet;
