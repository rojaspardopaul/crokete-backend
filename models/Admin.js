const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: Object,
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
    status: {
      type: String,
      required: false,
      default: "activo",
      enum: ["activo", "inactivo"],
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      default: "admin",
      enum: [
        "admin",
        "super admin",
        "cashier",
        "manager",
        "ceo",
        "driver",
        "security guard",
        "accountant",
      ],
      lowercase: true,
    },
    access_list: {
      type: Array,
      required: false,
    },
    joiningData: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
