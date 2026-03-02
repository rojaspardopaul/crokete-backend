const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: {
      type: Object,
      required: true,
    },
    icon: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      lowercase: true,
      enum: ["show", "hide"],
      default: "show",
    },
  },
  {
    timestamps: true,
  }
);

const Pet = mongoose.model("Pet", petSchema);
module.exports = Pet;
