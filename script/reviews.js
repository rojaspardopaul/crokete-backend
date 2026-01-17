// scripts/seedReviews.js
const mongoose = require("mongoose");
const faker = require("faker");

// Load models
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Review = require("../models/Review");
const { connectDB } = require("../config/db");
const productImages = require("../utils/product-images");

// Connect to DB
connectDB();
const reviewComments = [
  // Positive
  "Excellent quality and fast delivery!",
  "Very satisfied with my purchase.",
  "Product was exactly as described.",
  "Great value for the money.",
  "Customer service was very helpful.",
  "Would definitely buy again.",
  "Packaging was secure and neat.",
  "Item arrived earlier than expected.",
  "Highly recommended to others.",
  "Five stars for quality and service!",
  "Superb product, exceeded expectations.",
  "Affordable price with great quality.",
  "Easy to use and works perfectly.",
  "Impressive design and build quality.",
  "Worth every penny I spent.",

  // Neutral
  "Product is okay, nothing special.",
  "Delivery took longer than expected but the product is fine.",
  "Average quality, meets basic expectations.",
  "The item works, but there is room for improvement.",
  "Not bad, but not exceptional either.",
  "Product is decent for the price.",
  "It does the job, but nothing stands out.",
  "Neutral experience, neither good nor bad.",
  "Received what I ordered, no issues.",
  "Satisfactory, but could be better.",

  // Negative
  "Poor quality, not as described.",
  "The product broke after first use.",
  "Very disappointed with this purchase.",
  "Packaging was damaged and messy.",
  "Item arrived late and in bad condition.",
  "Customer service was unhelpful.",
  "Not worth the price.",
  "The product does not work properly.",
  "Low quality material, feels cheap.",
  "I would not recommend this product.",
];
const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$product",
        average_rating: { $avg: "$rating" },
        total_reviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      average_rating: result[0].average_rating,
      total_reviews: result[0].total_reviews,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      average_rating: 0,
      total_reviews: 0,
    });
  }
};

const seedReviews = async () => {
  try {
    const customers = await Customer.find({});
    const products = await Product.find({}).sort({ sales: -1 }).limit(40);

    if (!customers.length || !products.length) {
      console.log("No customers or products found.");
      return;
    }

    const reviewCount = 200; // how many reviews to create

    for (let i = 0; i < reviewCount; i++) {
      const randomCustomer =
        customers[Math.floor(Math.random() * customers.length)];
      const randomProduct =
        products[Math.floor(Math.random() * products.length)];

      // const existingReview = await Review.findOne({
      //   product: randomProduct._id,
      //   user: randomCustomer._id,
      // });

      // if (existingReview) continue; // skip if already reviewed

      const rating = faker.datatype.number({ min: 1, max: 5 });
      const comment =
        reviewComments[Math.floor(Math.random() * reviewComments.length)];

      // Get the main product image from productImages
      const result = productImages.find(
        (img) => img._id.toString() === randomProduct._id.toString()
      );

      let images = [];

      if (result) {
        // Flatten if result.image is an array
        if (Array.isArray(result.image)) {
          images.push(...result.image);
        } else {
          images.push(result.image);
        }
      }

      // Pick random images from productImages array (not necessarily the same product)
      const shuffledProductImages = [...productImages]
        .sort(() => 0.5 - Math.random())
        .map((p) => (Array.isArray(p.image) ? p.image[0] : p.image)); // take first image if array

      // Take random images until we have max 4
      for (const img of shuffledProductImages) {
        if (images.length >= 4) break;
        if (!images.includes(img)) images.push(img);
      }

      // Save review
      await Review.create({
        product: randomProduct._id,
        user: randomCustomer._id,
        rating,
        comment,
        images, // ✅ this is now a flat array of strings
      });

      await updateProductRating(randomProduct._id);
      console.log(
        `Review added for ${randomProduct.title?.en} by ${randomCustomer.name}`
      );
    }

    console.log("✅ Demo reviews seeded successfully.");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedReviews();

const updateReviews = async () => {
  try {
    const reviews = await Review.find({}).populate("product").populate("user");

    if (!reviews.length) {
      console.log("No reviews found.");
      return;
    }

    for (let i = 0; i < reviews.length; i++) {
      const randomCustomer = reviews[i].user;
      const randomProduct = reviews[i].product;

      // Pick a random comment
      const comment =
        reviewComments[Math.floor(Math.random() * reviewComments.length)];

      // Find matching images by product _id
      const result = productImages.find(
        (img) => img._id.toString() === randomProduct._id.toString()
      );

      const images = result?.image;

      const rating = faker.datatype.number({ min: 2, max: 5 });

      await Review.updateOne(
        { _id: reviews[i]._id },
        {
          rating,
          comment,
          images,
        }
      );

      await updateProductRating(randomProduct._id);

      console.log(
        `✅ Review updated for ${randomProduct?.title?.en || "Untitled"} by ${
          randomCustomer?.name || "Unknown"
        }`
      );
    }

    console.log("🎯 All reviews updated with new images and English comments.");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updateReviews();
