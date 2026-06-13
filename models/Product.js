const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: false,
    },
    sku: {
      type: String,
      required: false,
    },
    barcode: {
      type: String,
      required: false,
    },
    title: {
      type: Object,
      required: true,
    },
    description: {
      type: Object,
      required: false,
    },
    slug: {
      type: String,
      required: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: false,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
    },
    image: {
      type: Array,
      required: false,
    },
    stock: {
      type: Number,
      required: false,
      min: 0,
    },

    sales: {
      type: Number,
      required: false,
    },

    tag: [String],
    prices: {
      originalPrice: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        required: false,
      },
    },
    variants: [{}],
    isCombination: {
      type: Boolean,
      required: true,
    },
    average_rating: {
      type: Number,
      default: 0,
    },
    total_reviews: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      default: "show",
      enum: ["show", "hide"],
    },

    // ─── Product type discriminator ──────────────────────────────
    productType: {
      type: String,
      enum: ["food", "medicine", "accessory", "general"],
      default: "general",
    },

    // ─── Pet compatibility (structured for filtering) ────────────
    petCompatibility: {
      petType: {
        type: [String],
        enum: ["dog", "cat", "both"],
        default: [],
      },
      ageRange: {
        type: [String],
        enum: ["puppy", "adult", "senior", "all"],
        default: [],
      },
      size: {
        type: [String],
        enum: ["mini", "small", "medium", "large", "giant", "all"],
        default: [],
      },
      breed: {
        type: [String],
        default: [],
      },
      specialNeeds: {
        type: [String],
        enum: [
          "sensitive_stomach",
          "weight_control",
          "urinary",
          "dental",
          "skin_coat",
          "joint",
          "hypoallergenic",
        ],
        default: [],
      },
    },

    // ─── Quick info (text for display, above-the-fold) ───────────
    quickInfo: {
      pet: { type: String },
      age: { type: String },
      size: { type: String },
      weightRange: { type: String },
      highlight: { type: String },
    },

    // ─── Package info (for price-per-kg calculation) ─────────────
    packageInfo: {
      weight: { type: Number },
      unit: {
        type: String,
        // peso: kg/g/mg/lb/oz · volumen: l/ml · conteo: pieza
        enum: ["kg", "g", "mg", "l", "ml", "lb", "oz", "pieza"],
      },
      servings: { type: Number },
    },

    // ─── Rich content fields (multilingual Objects) ──────────────
    benefits: { type: Object },
    features: { type: Object },
    ingredients: { type: Object },
    feedingGuide: { type: Object },
    indications: { type: Object },
    warnings: { type: Object },
    dosage: { type: Object },
    recommendedFor: { type: Object },
    brandInfo: { type: Object },

    // ─── Nutrition table (structured) ────────────────────────────
    nutritionTable: {
      guaranteedAnalysis: [
        {
          nutrient: { type: String },
          value: { type: String },
          unit: { type: String },
        },
      ],
      calories: { type: String },
      caloriesPerKg: { type: Number },
    },

    // ─── Technical specs for accessories (key-value) ─────────────
    technicalSpecs: [
      {
        key: { type: Object },
        value: { type: Object },
      },
    ],

    // ─── Consumption guide (food only, structured) ───────────────
    consumptionGuide: [
      {
        petWeight: { type: Number },
        dailyAmount: { type: Number },
        durationDays: { type: Number },
      },
    ],

    // ─── Product highlights (short bullets for quick decision) ───
    productHighlights: {
      type: [String],
      default: [],
    },

    // ─── Key facts (summary data pills) ─────────────────────────
    keyFacts: [
      {
        label: { type: String },
        value: { type: String },
      },
    ],

    // ─── Visual tags (marketing badges) ──────────────────────────
    visualTags: {
      type: [String],
      enum: [
        "new",
        "bestseller",
        "organic",
        "grain_free",
        "prescription",
        "eco",
        "limited_edition",
        "vet_recommended",
        "sale",
      ],
      default: [],
    },

    // ─── Icon tags (technical attribute icons) ───────────────────
    iconTags: {
      type: [String],
      enum: [
        "grain_free",
        "high_protein",
        "vet_recommended",
        "natural",
        "hypoallergenic",
        "low_fat",
        "organic",
        "no_artificial",
        "prebiotics",
        "omega_3_6",
        "gluten_free",
        "sugar_free",
        "sensitive_stomach",
        "joint_support",
        "skin_coat",
        "dental_care",
        "weight_control",
        "puppy_formula",
        "pregnant_dog",
        "newborn_puppy",
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes para performance de queries ─────────────────────────
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, categories: 1 });
productSchema.index({ status: 1, sales: -1 });
productSchema.index({ status: 1, "prices.originalPrice": 1 });
productSchema.index({ productType: 1, status: 1 });
productSchema.index({ "petCompatibility.petType": 1, status: 1 });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
