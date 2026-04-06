const cache = require("../../utils/cache");
const Product = require("../../models/Product");
const Category = require("../../models/Category");

/**
 * Estructura categorías en jerarquía padre-hijo.
 * Réplica de la función en categoryController para evitar dependencia circular.
 */
function buildCategoryTree(categories, parentId = null) {
  const list = [];
  const filtered = parentId == null
    ? categories.filter((c) => c.parentId == undefined)
    : categories.filter((c) => String(c.parentId) === String(parentId));

  for (const cat of filtered) {
    list.push({
      _id: cat._id,
      name: cat.name,
      parentId: cat.parentId,
      parentName: cat.parentName,
      description: cat.description,
      icon: cat.icon,
      status: cat.status,
      children: buildCategoryTree(categories, cat._id),
    });
  }
  return list;
}

/**
 * Precarga el cache con las queries más frecuentes.
 * Se ejecuta una sola vez al iniciar el servidor (después de connectDB).
 */
async function warmCache() {
  try {
    // 1. Categorías visibles
    const categories = await Category.find({ status: "show" }).sort({ _id: -1 }).lean();
    const categoryTree = buildCategoryTree(categories);
    cache.set("categories:show", categoryTree, 600);
    console.log(`  🔥 Cache warmed: categorías (${categoryTree.length} raíz)`);

    // 2. Home products (listing sin filtros + popular + discounted)
    const [products, popularProducts, discountedProducts] = await Promise.all([
      Product.find({ status: "show" })
        .populate({ path: "category", select: "name _id" })
        .populate({ path: "pet", select: "name _id" })
        .populate({ path: "brand", select: "name _id" })
        .sort({ _id: -1 })
        .limit(100)
        .lean(),
      Product.find({ status: "show" })
        .populate({ path: "category", select: "name _id" })
        .populate({ path: "pet", select: "name _id" })
        .populate({ path: "brand", select: "name _id" })
        .sort({ sales: -1 })
        .limit(20)
        .lean(),
      Product.find({
        status: "show",
        $or: [
          { $and: [{ isCombination: true }, { variants: { $elemMatch: { discount: { $gt: "0.00" } } } }] },
          { $and: [{ isCombination: false }, { $expr: { $gt: [{ $toDouble: "$prices.discount" }, 0] } }] },
        ],
      })
        .populate({ path: "category", select: "name _id" })
        .sort({ _id: -1 })
        .limit(20)
        .lean(),
    ]);

    const homeData = {
      products,
      popularProducts,
      discountedProducts,
      relatedProducts: [],
      reviews: [],
    };
    cache.set("products:home", homeData, 60);
    console.log(`  🔥 Cache warmed: home (${products.length} productos, ${popularProducts.length} populares, ${discountedProducts.length} descuento)`);
  } catch (err) {
    console.error("  ⚠️  Error en cache warming:", err.message);
  }
}

module.exports = { warmCache };
