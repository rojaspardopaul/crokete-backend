const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true, // e.g. 'en', 'bn'
      lowercase: true,
    },

    flag: {
      type: String,
      required: false,
    },
    // rtl: {
    //   type: Boolean,
    //   default: false,
    // },
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

const Language = mongoose.model("Language", languageSchema);
module.exports = Language;
