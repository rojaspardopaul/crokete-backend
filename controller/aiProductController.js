/**
 * AI Product Controller
 * Handles product data generation using AI providers.
 */

const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Pet = require("../models/Pet");
const Attribute = require("../models/Attribute");
const { generateProductJSON, getAvailableProviders } = require("../lib/ai/providers");
const { buildProductPrompt } = require("../lib/ai/promptBuilder");

/**
 * POST /ai/generate-product
 * Generate product data using AI.
 *
 * Body: {
 *   productName: string (required),
 *   productType: "food" | "medicine" | "accessory" (required),
 *   provider: "gemini" | "openai" (default: "gemini"),
 *   brandId: string (optional - MongoDB ObjectId),
 *   categoryId: string (optional - MongoDB ObjectId),
 *   petType: "dog" | "cat" | "both" (optional),
 *   additionalInfo: string (optional - extra context from user)
 * }
 */
const generateProductData = async (req, res) => {
  try {
    const {
      productName,
      productType,
      provider = "gemini",
      brandId,
      categoryId,
      petType,
      additionalInfo,
    } = req.body;

    // Images sent as data URLs (or {mimeType,data}). Used for vision/OCR only —
    // they are NEVER uploaded to Cloudinary; we just extract text/info from them.
    const images = normalizeImages(req.body.images);

    // ─── Validation ────────────────────────────────────────────
    if ((!productName || !productName.trim()) && images.length === 0) {
      return res.status(400).json({
        message: "Ingresa el nombre del producto o adjunta al menos una imagen.",
      });
    }

    if (!productType || !["food", "medicine", "accessory"].includes(productType)) {
      return res.status(400).json({
        message: "El tipo de producto debe ser: food, medicine o accessory.",
      });
    }

    // Check provider availability
    const available = getAvailableProviders();
    if (!available[provider]) {
      // Fallback to the other provider if available
      const fallback = provider === "gemini" ? "openai" : "gemini";
      if (!available[fallback]) {
        return res.status(503).json({
          message:
            "No hay proveedores de IA configurados. Agrega GEMINI_API_KEY o OPENAI_API_KEY en las variables de entorno.",
        });
      }
      // Use fallback silently
      req.body.provider = fallback;
    }

    const effectiveProvider = available[provider] ? provider : (provider === "gemini" ? "openai" : "gemini");

    // ─── Fetch real DB context ─────────────────────────────────
    const contextData = {};
    let brandName = "";
    let categoryName = "";

    // Fetch category info
    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (category) {
        contextData.categoryId = category._id.toString();
        contextData.categoryIds = [category._id.toString()];
        categoryName = category.name?.es || category.name?.en || "";
      }
    }

    // Fetch brand info
    if (brandId) {
      const brand = await Brand.findById(brandId);
      if (brand) {
        contextData.brandId = brand._id.toString();
        brandName = brand.name?.es || brand.name?.en || "";
      }
    }

    // Fetch pet info
    if (petType) {
      const petQuery = petType === "both" 
        ? {} 
        : { $or: [{ "name.es": new RegExp(petType === "dog" ? "perro" : "gato", "i") }] };
      const pet = await Pet.findOne(petQuery);
      if (pet) {
        contextData.petId = pet._id.toString();
      }
    }

    // ─── Build prompt & generate ───────────────────────────────
    const imagesNote = images.length
      ? "\n\nIMPORTANTE: Se adjuntaron imágenes del producto/empaque. Extrae de ellas toda la información posible (nombre, marca, ingredientes, análisis garantizado/tabla nutricional, indicaciones, dosis, advertencias, peso/presentación, etc.) y úsala para completar los campos."
      : "";

    const prompt = buildProductPrompt({
      productName: productName?.trim() || "(identificar a partir de las imágenes adjuntas)",
      productType,
      brandName,
      categoryName,
      petType,
      additionalInfo: (additionalInfo?.trim() || "") + imagesNote,
      contextData,
    });

    const aiData = await generateProductJSON(effectiveProvider, prompt, images);

    // ─── Post-process: inject real IDs ─────────────────────────
    const productData = postProcessAIResponse(aiData, contextData);

    return res.status(200).json({
      success: true,
      provider: effectiveProvider,
      product: productData,
    });
  } catch (err) {
    console.error("AI Generate Product Error:", err);

    // Quota exhausted (all Gemini models tried)
    if (err.type === "QUOTA_EXHAUSTED") {
      return res.status(429).json({ message: err.message });
    }

    // Handle specific AI provider errors
    if (err.message?.includes("API_KEY") || err.message?.includes("API key")) {
      return res.status(503).json({
        message: "Error de configuración del proveedor de IA. Verifica las API keys.",
      });
    }

    return res.status(500).json({
      message: "Error al generar datos del producto con IA. Intenta de nuevo.",
      error: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
};

/**
 * GET /ai/providers
 * Return which AI providers are available.
 */
const getProviders = async (req, res) => {
  try {
    const providers = getAvailableProviders();
    return res.status(200).json(providers);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_IMAGES = 6;
const ALLOWED_IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;

/**
 * Normalize incoming images to [{ mimeType, data(base64) }]. Accepts either
 * data-URL strings ("data:image/jpeg;base64,...") or { mimeType, data } objects.
 * Used for AI vision only — images are never persisted/uploaded.
 */
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  const out = [];
  for (const img of images.slice(0, MAX_IMAGES)) {
    if (typeof img === "string") {
      const m = img.match(/^data:([^;]+);base64,(.+)$/);
      if (m && ALLOWED_IMAGE_MIME.test(m[1])) {
        out.push({ mimeType: m[1], data: m[2] });
      }
    } else if (img && typeof img.data === "string" && typeof img.mimeType === "string") {
      if (ALLOWED_IMAGE_MIME.test(img.mimeType)) {
        out.push({ mimeType: img.mimeType, data: img.data.replace(/^data:[^;]+;base64,/, "") });
      }
    }
  }
  return out;
}

/**
 * Post-process AI response to inject real MongoDB IDs
 * and ensure data shape matches the Product model.
 */
function postProcessAIResponse(aiData, contextData) {
  const product = { ...aiData };

  // Ensure required fields
  if (!product.title || typeof product.title === "string") {
    product.title = { es: product.title || "" };
  }
  if (!product.description || typeof product.description === "string") {
    product.description = { es: product.description || "" };
  }

  // Inject real category IDs
  if (contextData.categoryId) {
    product.category = contextData.categoryId;
    product.categories = contextData.categoryIds || [contextData.categoryId];
  }

  // Inject real brand ID
  if (contextData.brandId) {
    product.brand = contextData.brandId;
  }

  // Inject real pet ID
  if (contextData.petId) {
    product.pet = contextData.petId;
  }

  // Ensure slug format
  if (!product.slug && product.title?.es) {
    product.slug = product.title.es
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Ensure prices structure
  if (product.prices) {
    product.prices.originalPrice = Number(product.prices.originalPrice) || 0;
    product.prices.price = Number(product.prices.price) || 0;
    product.prices.discount =
      Number(product.prices.discount) ||
      product.prices.originalPrice - product.prices.price;
  }

  // Ensure arrays
  product.visualTags = Array.isArray(product.visualTags) ? product.visualTags : [];
  product.iconTags = Array.isArray(product.iconTags) ? product.iconTags : [];
  product.productHighlights = Array.isArray(product.productHighlights) ? product.productHighlights : [];
  product.keyFacts = Array.isArray(product.keyFacts) ? product.keyFacts : [];
  product.tag = Array.isArray(product.tag) ? product.tag : [];

  // Ensure multilingual objects for rich text fields
  const multilingualFields = [
    "benefits", "features", "ingredients", "feedingGuide",
    "indications", "warnings", "dosage", "recommendedFor", "brandInfo",
  ];
  for (const field of multilingualFields) {
    if (product[field] && typeof product[field] === "string") {
      product[field] = { es: product[field] };
    }
  }

  // Ensure nutritionTable structure
  if (product.nutritionTable) {
    if (!Array.isArray(product.nutritionTable.guaranteedAnalysis)) {
      product.nutritionTable.guaranteedAnalysis = [];
    }
    product.nutritionTable.calories = product.nutritionTable.calories || "";
  }

  // Ensure technicalSpecs structure
  if (Array.isArray(product.technicalSpecs)) {
    product.technicalSpecs = product.technicalSpecs.map((spec) => ({
      key: typeof spec.key === "string" ? { es: spec.key } : spec.key || { es: "" },
      value: typeof spec.value === "string" ? { es: spec.value } : spec.value || { es: "" },
    }));
  }

  // Ensure consumptionGuide structure
  if (Array.isArray(product.consumptionGuide)) {
    product.consumptionGuide = product.consumptionGuide.map((entry) => ({
      petWeight: Number(entry.petWeight) || 0,
      dailyAmount: Number(entry.dailyAmount) || 0,
      durationDays: Number(entry.durationDays) || 0,
    }));
  }

  // Process variants — keep _variantLabel format for frontend mapping
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    product.isCombination = true;
  } else {
    product.isCombination = false;
    product.variants = [];
  }

  // Default status
  product.status = "show";

  // Remove fields that shouldn't be set by AI
  delete product._id;
  delete product.average_rating;
  delete product.total_reviews;
  delete product.sales;

  return product;
}

module.exports = { generateProductData, getProviders };
