require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    });
    console.log("mongodb connection success!");
  } catch (err) {
    console.error("mongodb connection failed!", err.message);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
};
