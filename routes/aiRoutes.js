const express = require("express");
const router = express.Router();
const { generateProductData, getProviders } = require("../controller/aiProductController");

// GET  /ai/providers         → check available AI providers
router.get("/providers", getProviders);

// POST /ai/generate-product  → generate product data with AI
router.post("/generate-product", generateProductData);

module.exports = router;
