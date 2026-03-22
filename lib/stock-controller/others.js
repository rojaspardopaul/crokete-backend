require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../../models/Product");

// const base = 'https://api-m.sandbox.paypal.com';

// decrease product quantity after a order created
// Uses aggregation pipeline updates (MongoDB 4.2+) to clamp stock/quantity to a minimum of 0,
// preventing negative values if an order is placed concurrently or stock data is inconsistent.
const handleProductQuantity = async (cart) => {
  try {
    for (const p of cart) {
      if (p?.isCombination) {
        // Pipeline update: decrement the matching variant's quantity and the product-level stock,
        // both floored at 0 to avoid negative values.
        await Product.findOneAndUpdate(
          {
            _id: p._id,
            "variants.productId": p?.variant?.productId || "",
          },
          [
            {
              $set: {
                stock: {
                  $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, p.quantity] }],
                },
                sales: {
                  $add: [{ $ifNull: ["$sales", 0] }, p.quantity],
                },
                variants: {
                  $map: {
                    input: "$variants",
                    as: "v",
                    in: {
                      $cond: [
                        { $eq: ["$$v.productId", p?.variant?.productId || ""] },
                        {
                          $mergeObjects: [
                            "$$v",
                            {
                              quantity: {
                                $max: [
                                  0,
                                  { $subtract: [{ $ifNull: ["$$v.quantity", 0] }, p.quantity] },
                                ],
                              },
                            },
                          ],
                        },
                        "$$v",
                      ],
                    },
                  },
                },
              },
            },
          ],
          { new: true }
        );
      } else {
        await Product.findOneAndUpdate(
          { _id: p._id },
          [
            {
              $set: {
                stock: {
                  $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, p.quantity] }],
                },
                sales: {
                  $add: [{ $ifNull: ["$sales", 0] }, p.quantity],
                },
              },
            },
          ],
          { new: true }
        );
      }
    }
  } catch (err) {
    console.log("err on handleProductQuantity", err.message);
  }
};

const handleProductAttribute = async (key, value, multi) => {
  try {
    // const products = await Product.find({ 'variants.1': { $exists: true } });
    const products = await Product.find({ isCombination: true });

    // console.log('products', products);

    if (multi) {
      for (const p of products) {
        await Product.updateOne(
          { _id: p._id },
          {
            $pull: {
              variants: { [key]: { $in: value } },
            },
          }
        );
      }
    } else {
      for (const p of products) {
        // console.log('p', p._id);
        await Product.updateOne(
          { _id: p._id },
          {
            $pull: {
              variants: { [key]: value },
            },
          }
        );
      }
    }
  } catch (err) {
    console.log("err, when delete product variants", err.message);
  }
};

module.exports = {
  handleProductQuantity,
  handleProductAttribute,
};
