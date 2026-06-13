const Product = require("../models/Product");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Review = require("../models/Review");
const { languageCodes } = require("../utils/data");
const escapeRegex = require("../utils/escapeRegex");
const cache = require("../utils/cache");
const { invalidateProducts, invalidateProductBySlug, invalidateAll } = require("../lib/cache/invalidation");
const { findDescendantCategoryIds } = require("../utils/categoryHierarchy");

const addProduct = async (req, res) => {
  try {
    const newProduct = new Product({
      ...req.body,
      // productId: cname + (count + 1),
      productId: req.body.productId
        ? req.body.productId
        : new mongoose.Types.ObjectId(),
    });

    await newProduct.save();
    invalidateProducts();
    res.send(newProduct);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const addAllProducts = async (req, res) => {
  try {
    // console.log('product data',req.body)
    await Product.deleteMany();
    await Product.insertMany(req.body);
    invalidateAll();
    res.status(200).send({
      message: "¡Producto agregado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShowingProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "show" }).sort({ _id: -1 });
    res.send(products);
    // console.log("products", products);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllProducts = async (req, res) => {
  const { title, category, price, page, limit } = req.query;

  // console.log("getAllProducts");

  let queryObject = {};
  let sortObject = {};
  if (title) {
    const safeTitle = escapeRegex(title);
    const titleQueries = languageCodes.map((lang) => ({
      [`title.${lang}`]: { $regex: safeTitle, $options: "i" },
    }));
    queryObject.$or = titleQueries;
  }

  if (price === "low") {
    sortObject = {
      "prices.originalPrice": 1,
    };
  } else if (price === "high") {
    sortObject = {
      "prices.originalPrice": -1,
    };
  } else if (price === "published") {
    queryObject.status = "show";
  } else if (price === "unPublished") {
    queryObject.status = "hide";
  } else if (price === "status-selling") {
    queryObject.stock = { $gt: 0 };
  } else if (price === "status-out-of-stock") {
    queryObject.stock = { $lt: 1 };
  } else if (price === "date-added-asc") {
    sortObject.createdAt = 1;
  } else if (price === "date-added-desc") {
    sortObject.createdAt = -1;
  } else if (price === "date-updated-asc") {
    sortObject.updatedAt = 1;
  } else if (price === "date-updated-desc") {
    sortObject.updatedAt = -1;
  } else {
    sortObject = { _id: -1 };
  }

  // console.log('sortObject', sortObject);

  let categoryFilterIds = [];

  if (category) {
    const categories = await Category.find({}).select("_id parentId").lean();
    categoryFilterIds = findDescendantCategoryIds(categories, category);
  }

  if (categoryFilterIds.length > 0) {
    queryObject.$and = [
      {
        $or: [
          { categories: { $in: categoryFilterIds } },
          { category: { $in: categoryFilterIds } },
        ],
      },
    ];
  }

  if (queryObject.$or && queryObject.$and) {
    queryObject.$and.unshift({ $or: queryObject.$or });
    delete queryObject.$or;
  }

  const pages = Number(page);
  const limits = Number(limit);
  const skip = (pages - 1) * limits;

  try {
    const totalDoc = await Product.countDocuments(queryObject);

    const products = await Product.find(queryObject)
      .populate({ path: "category", select: "_id name" })
      .populate({ path: "categories", select: "_id name" })
      .sort(sortObject)
      .skip(skip)
      .limit(limits);

    res.send({
      products,
      totalDoc,
      limits,
      pages,
    });
  } catch (err) {
    // console.log("error", err);
    res.status(500).send({
      message: err.message,
    });
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `product:slug:${slug}`;

    const { data, fromCache } = await cache.getOrFetch(cacheKey, () =>
      Product.findOne({ slug }).lean()
    );

    cache.setCacheHeaders(res, fromCache, cache.resolveTTL(cacheKey));
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: `Slug problem, ${err.message}`,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({ path: "category", select: "_id, name" })
      .populate({ path: "categories", select: "_id name" });

    res.send(product);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateProduct = async (req, res) => {
  // console.log('update product')
  // console.log('variant',req.body.variants)
  try {
    const product = await Product.findById(req.params.id);
    // console.log("product", product);

    if (product) {
      product.title = { ...product.title, ...req.body.title };
      product.description = {
        ...product.description,
        ...req.body.description,
      };

      product.productId = req.body.productId;
      product.sku = req.body.sku;
      product.barcode = req.body.barcode;
      product.slug = req.body.slug;
      product.categories = req.body.categories;
      product.category = req.body.category;
      product.show = req.body.show;
      product.isCombination = req.body.isCombination;
      product.variants = req.body.variants;
      product.stock = req.body.stock;
      product.prices = req.body.prices;
      product.image = req.body.image;
      product.tag = req.body.tag;
      product.pet = req.body.pet || null;
      product.brand = req.body.brand || null;

      // ─── Extended product fields ───────────────────────────────
      if (req.body.productType !== undefined) product.productType = req.body.productType;
      if (req.body.petCompatibility !== undefined) product.petCompatibility = req.body.petCompatibility;
      if (req.body.quickInfo !== undefined) product.quickInfo = req.body.quickInfo;
      if (req.body.packageInfo !== undefined) product.packageInfo = req.body.packageInfo;
      if (req.body.benefits !== undefined) product.benefits = { ...product.benefits, ...req.body.benefits };
      if (req.body.features !== undefined) product.features = { ...product.features, ...req.body.features };
      if (req.body.ingredients !== undefined) product.ingredients = { ...product.ingredients, ...req.body.ingredients };
      if (req.body.feedingGuide !== undefined) product.feedingGuide = { ...product.feedingGuide, ...req.body.feedingGuide };
      if (req.body.indications !== undefined) product.indications = { ...product.indications, ...req.body.indications };
      if (req.body.warnings !== undefined) product.warnings = { ...product.warnings, ...req.body.warnings };
      if (req.body.dosage !== undefined) product.dosage = { ...product.dosage, ...req.body.dosage };
      if (req.body.recommendedFor !== undefined) product.recommendedFor = { ...product.recommendedFor, ...req.body.recommendedFor };
      if (req.body.brandInfo !== undefined) product.brandInfo = { ...product.brandInfo, ...req.body.brandInfo };
      if (req.body.nutritionTable !== undefined) product.nutritionTable = req.body.nutritionTable;
      if (req.body.technicalSpecs !== undefined) product.technicalSpecs = req.body.technicalSpecs;
      if (req.body.consumptionGuide !== undefined) product.consumptionGuide = req.body.consumptionGuide;
      if (req.body.productHighlights !== undefined) product.productHighlights = req.body.productHighlights;
      if (req.body.keyFacts !== undefined) product.keyFacts = req.body.keyFacts;
      if (req.body.visualTags !== undefined) product.visualTags = req.body.visualTags;
      if (req.body.iconTags !== undefined) product.iconTags = req.body.iconTags;

      const oldSlug = product.slug;
      await product.save();
      invalidateProductBySlug(oldSlug);
      invalidateProductBySlug(req.body.slug);
      invalidateProducts();
      res.send({ data: product, message: "¡Producto actualizado correctamente!" });
    } else {
      res.status(404).send({
        message: "¡Producto no encontrado!",
      });
    }
  } catch (err) {
    res.status(404).send(err.message);
  }
};

const updateManyProducts = async (req, res) => {
  try {
    const updatedData = {};
    for (const key of Object.keys(req.body)) {
      if (
        req.body[key] !== "[]" &&
        Object.entries(req.body[key]).length > 0 &&
        req.body[key] !== req.body.ids
      ) {
        // console.log('req.body[key]', typeof req.body[key]);
        updatedData[key] = req.body[key];
      }
    }

    // console.log("updated data", updatedData);

    await Product.updateMany(
      { _id: { $in: req.body.ids } },
      {
        $set: updatedData,
      },
      {
        multi: true,
      }
    );
    invalidateProducts();
    res.send({
      message: "¡Productos actualizados correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const newStatus = req.body.status;

    await Product.updateOne(
      { _id: req.params.id },
      { $set: { status: newStatus } }
    );

    invalidateProducts();
    res.status(200).send({
      message: `¡Producto ${newStatus} correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id });
    invalidateProducts();
    res.status(200).send({
      message: "¡Producto eliminado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShowingStoreProducts = async (req, res) => {
  try {
    const { category, title, slug, pet, brand } = req.query;

    // ── Validación de longitud de búsqueda ──
    if (title && title.length > 100) {
      return res.status(400).send({ message: "Búsqueda demasiado larga (máximo 100 caracteres)." });
    }

    // ── Admin bypass: no cachear para admins ──
    const isAdminUser = req.user && (req.user.role === "Admin" || req.user.role === "Super Admin");
    if (isAdminUser) {
      cache.trackBypass();
    }

    // ── Construir cache key normalizada ──
    let cacheKey;
    let ttl;
    if (slug) {
      cacheKey = `product:slug:${slug}`;
      ttl = 300;
    } else if (title) {
      cacheKey = cache.buildCacheKey("search", { title });
      ttl = 30;
    } else if (category || pet || brand) {
      const filterParams = {};
      if (category) filterParams.category = category;
      if (pet) filterParams.pet = pet;
      if (brand) filterParams.brand = brand;
      cacheKey = cache.buildCacheKey("products", filterParams);
      ttl = 60;
    } else {
      cacheKey = "products:home";
      ttl = 60;
    }

    // ── Cache-first (skip para admins) ──
    if (!isAdminUser) {
      const { data: cached, fromCache } = await cache.getOrFetch(
        cacheKey,
        () => executeStoreQuery({ category, title, slug, pet, brand }),
        ttl
      );
      cache.setCacheHeaders(res, fromCache, ttl);
      return res.send(cached);
    }

    // Admin: query directa sin cache
    const data = await executeStoreQuery({ category, title, slug, pet, brand });
    cache.setCacheHeaders(res, false, 0, "admin");
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

/**
 * Ejecuta la query real a MongoDB para getShowingStoreProducts.
 * Extraído para ser usado tanto en cache miss como en admin bypass.
 */
async function executeStoreQuery({ category, title, slug, pet, brand }) {
  const queryObject = { status: "show" };
  let categoryFilterIds = [];

  if (category) {
    const categories = await Category.find({ status: "show" })
      .select("_id parentId")
      .lean();
    categoryFilterIds = findDescendantCategoryIds(categories, category);
  }
  if (pet) {
    queryObject.pet = pet;
  }
  if (brand) {
    queryObject.brand = brand;
  }

  if (title) {
    const safeTitle = escapeRegex(title);
    const regex = { $regex: safeTitle, $options: "i" };

    const fieldQueries = languageCodes.flatMap((lang) => [
      { [`title.${lang}`]: regex },
      { [`description.${lang}`]: regex },
    ]);
    fieldQueries.push({ tag: regex });

    const [matchingBrands, matchingCategories] = await Promise.all([
      Brand.find({
        $or: languageCodes.map((lang) => ({ [`name.${lang}`]: regex })),
      }).select("_id").maxTimeMS(5000),
      Category.find({
        $or: languageCodes.map((lang) => ({ [`name.${lang}`]: regex })),
      }).select("_id").maxTimeMS(5000),
    ]);

    if (matchingBrands.length > 0) {
      fieldQueries.push({ brand: { $in: matchingBrands.map((b) => b._id) } });
    }
    if (matchingCategories.length > 0) {
      const catIds = matchingCategories.map((c) => c._id);
      fieldQueries.push({ category: { $in: catIds } });
      fieldQueries.push({ categories: { $in: catIds } });
    }

    queryObject.$or = fieldQueries;
  }

  if (categoryFilterIds.length > 0) {
    const categoryClause = {
      $or: [
        { categories: { $in: categoryFilterIds } },
        { category: { $in: categoryFilterIds } },
      ],
    };

    if (queryObject.$or) {
      queryObject.$and = [{ $or: queryObject.$or }, categoryClause];
      delete queryObject.$or;
    } else {
      queryObject.$or = categoryClause.$or;
    }
  }

  if (slug) {
    queryObject.slug = { $regex: escapeRegex(slug), $options: "i" };
  }

  let products = [];
  let popularProducts = [];
  let discountedProducts = [];
  let relatedProducts = [];
  let reviews = [];

  if (slug) {
    products = await Product.find(queryObject)
      .populate({ path: "category", select: "name _id" })
      .populate({ path: "pet", select: "name _id" })
      .populate({ path: "brand", select: "name _id" })
      .sort({ _id: -1 })
      .limit(100)
      .maxTimeMS(5000)
      .lean();
    relatedProducts = await Product.find({
      category: products[0]?.category,
    }).populate({ path: "category", select: "_id name" })
      .populate({ path: "pet", select: "name _id" })
      .populate({ path: "brand", select: "name _id" })
      .maxTimeMS(5000)
      .lean();
    if (products[0]?._id) {
      reviews = await Review.find({ product: products[0]._id, status: "approved" }).populate({
        path: "user",
        select: "name image",
      }).maxTimeMS(5000).lean();
    }
  } else if (title || category || pet || brand) {
    products = await Product.find(queryObject)
      .populate({ path: "category", select: "name _id" })
      .populate({ path: "pet", select: "name _id" })
      .populate({ path: "brand", select: "name _id" })
      .sort({ _id: -1 })
      .limit(100)
      .maxTimeMS(5000)
      .lean();
  } else {
    [products, popularProducts, discountedProducts] = await Promise.all([
      Product.find({ status: "show" })
        .populate({ path: "category", select: "name _id" })
        .populate({ path: "pet", select: "name _id" })
        .populate({ path: "brand", select: "name _id" })
        .sort({ _id: -1 })
        .limit(100)
        .maxTimeMS(5000)
        .lean(),
      Product.find({ status: "show" })
        .populate({ path: "category", select: "name _id" })
        .populate({ path: "pet", select: "name _id" })
        .populate({ path: "brand", select: "name _id" })
        .sort({ sales: -1 })
        .limit(20)
        .maxTimeMS(5000)
        .lean(),
      Product.find({
        status: "show",
        $or: [
          {
            $and: [
              { isCombination: true },
              { variants: { $elemMatch: { discount: { $gt: "0.00" } } } },
            ],
          },
          {
            $and: [
              { isCombination: false },
              { $expr: { $gt: [{ $toDouble: "$prices.discount" }, 0] } },
            ],
          },
        ],
      })
        .populate({ path: "category", select: "name _id" })
        .sort({ _id: -1 })
        .limit(20)
        .maxTimeMS(5000)
        .lean(),
    ]);
  }

  return { reviews, products, popularProducts, relatedProducts, discountedProducts };
}

const deleteManyProducts = async (req, res) => {
  try {
    const cname = req.cname;
    // console.log("deleteMany", cname, req.body.ids);

    await Product.deleteMany({ _id: req.body.ids });

    invalidateProducts();
    res.send({
      message: `¡Productos eliminados correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

module.exports = {
  addProduct,
  addAllProducts,
  getAllProducts,
  getShowingProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  updateManyProducts,
  updateStatus,
  deleteProduct,
  deleteManyProducts,
  getShowingStoreProducts,
};
