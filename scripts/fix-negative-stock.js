/**
 * One-time migration: clamp all negative stock values to 0.
 *
 * Run once with:
 *   node scripts/fix-negative-stock.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function fixNegativeStock() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // 1. Fix top-level product stock
  const productResult = await Product.updateMany(
    { stock: { $lt: 0 } },
    { $set: { stock: 0 } }
  );
  console.log(`Fixed ${productResult.modifiedCount} product(s) with negative stock`);

  // 2. Fix variant quantity fields inside variants array
  const productsWithVariants = await Product.find({
    "variants.quantity": { $lt: 0 },
  });

  let variantFixed = 0;
  for (const product of productsWithVariants) {
    let dirty = false;
    product.variants = product.variants.map((v) => {
      if (typeof v.quantity === "number" && v.quantity < 0) {
        dirty = true;
        return { ...v, quantity: 0 };
      }
      return v;
    });
    if (dirty) {
      await product.save();
      variantFixed++;
    }
  }
  console.log(`Fixed ${variantFixed} product(s) with negative variant quantity`);

  await mongoose.disconnect();
  console.log("Done.");
}

fixNegativeStock().catch((err) => {
  console.error(err);
  process.exit(1);
});
