const { getPrisma } = require("../lib/prisma");
const { productToApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");
const cache = require("../utils/cache");
const {
  invalidateProducts,
  invalidateProductBySlug,
  invalidateAll,
} = require("../lib/cache/invalidation");
const { findDescendantCategoryIds } = require("../utils/categoryHierarchy");

const prisma = () => getPrisma();
const products = () => getPrisma().product;

/** Relaciones que la API heredada devolvía vía populate. */
const FULL_INCLUDE = {
  category: { select: { id: true, name: true } },
  pet: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  variants: true,
  categories: { include: { category: { select: { id: true, name: true } } } },
};

const ENUM_ARRAY_FIELDS = [
  "petCompatPetType",
  "petCompatAgeRange",
  "petCompatSize",
  "petCompatSpecialNeeds",
  "visualTags",
  "iconTags",
];

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Cuerpo de la API → columnas. Deshace el anidamiento que el front sigue
 * enviando (`prices`, `petCompatibility`, `packageInfo`) y descarta las
 * relaciones, que se tratan aparte.
 */
function toRow(body) {
  const row = {};
  const set = (key, value) => {
    if (value !== undefined) row[key] = value;
  };

  set("title", body.title);
  set("description", body.description);
  set("slug", body.slug);
  set("sku", body.sku);
  set("barcode", body.barcode);
  set("refCode", body.productId);
  set("image", body.image);
  set("tag", body.tag);
  set("status", body.status);
  set("productType", body.productType);
  set("quickInfo", body.quickInfo);
  set("nutritionTable", body.nutritionTable);
  set("technicalSpecs", body.technicalSpecs);
  set("consumptionGuide", body.consumptionGuide);
  set("keyFacts", body.keyFacts);
  set("productHighlights", body.productHighlights);
  set("benefits", body.benefits);
  set("features", body.features);
  set("ingredients", body.ingredients);
  set("feedingGuide", body.feedingGuide);
  set("indications", body.indications);
  set("warnings", body.warnings);
  set("dosage", body.dosage);
  set("recommendedFor", body.recommendedFor);
  set("brandInfo", body.brandInfo);

  if (body.stock !== undefined) row.stock = Math.trunc(toNumber(body.stock, 0));
  if (body.sales !== undefined) row.sales = Math.trunc(toNumber(body.sales, 0));
  if (body.isCombination !== undefined) row.isCombination = !!body.isCombination;

  if (body.prices) {
    if (body.prices.originalPrice !== undefined) {
      row.originalPrice = toNumber(body.prices.originalPrice, 0);
    }
    if (body.prices.price !== undefined) row.price = toNumber(body.prices.price, 0);
    if (body.prices.discount !== undefined) row.discount = toNumber(body.prices.discount, 0);
  }

  if (body.petCompatibility) {
    const pc = body.petCompatibility;
    if (pc.petType !== undefined) row.petCompatPetType = pc.petType || [];
    if (pc.ageRange !== undefined) row.petCompatAgeRange = pc.ageRange || [];
    if (pc.size !== undefined) row.petCompatSize = pc.size || [];
    if (pc.breed !== undefined) row.petCompatBreed = pc.breed || [];
    if (pc.specialNeeds !== undefined) row.petCompatSpecialNeeds = pc.specialNeeds || [];
  }

  if (body.packageInfo) {
    const pkg = body.packageInfo;
    if (pkg.weight !== undefined) row.packageWeight = toNumber(pkg.weight);
    if (pkg.unit !== undefined) row.packageUnit = pkg.unit || null;
    if (pkg.servings !== undefined) {
      const s = toNumber(pkg.servings);
      row.packageServings = s === null ? null : Math.trunc(s);
    }
  }

  if (body.visualTags !== undefined) row.visualTags = body.visualTags || [];
  if (body.iconTags !== undefined) row.iconTags = body.iconTags || [];

  // Un valor fuera del enum aborta el INSERT; se descartan los desconocidos
  // igual que Mongoose ignoraba lo que no estuviera en su enum.
  for (const field of ENUM_ARRAY_FIELDS) {
    if (Array.isArray(row[field])) {
      row[field] = row[field].map(String).filter(Boolean);
    }
  }

  return row;
}

/** Variantes de la API (claves dinámicas <attributeId>) → filas tipadas. */
function toVariantRows(variants) {
  const KNOWN = new Set([
    "originalPrice", "price", "quantity", "discount",
    "productId", "barcode", "sku", "image", "_id", "id",
  ]);

  return (variants || []).map((v) => {
    const attributes = {};
    for (const [k, val] of Object.entries(v)) {
      if (!KNOWN.has(k)) attributes[k] = val;
    }
    return {
      attributes,
      sku: v.sku || null,
      barcode: v.barcode || null,
      refCode: v.productId || null,
      image: v.image || null,
      originalPrice: toNumber(v.originalPrice, 0),
      price: toNumber(v.price, 0),
      discount: toNumber(v.discount, 0),
      quantity: Math.trunc(toNumber(v.quantity, 0)),
    };
  });
}

/** Ids de categoría (principal + N:M) saneados. */
function categoryIdsFrom(body) {
  return [...new Set([...(body.categories || []), body.category].filter(Boolean).map(String))]
    .filter(isUuid);
}

const addProduct = async (req, res) => {
  try {
    const row = toRow(req.body);
    if (!isUuid(req.body.category)) {
      return res.status(400).send({ message: "La categoría del producto no es válida." });
    }
    row.categoryId = req.body.category;
    row.petId = isUuid(req.body.pet) ? req.body.pet : null;
    row.brandId = isUuid(req.body.brand) ? req.body.brand : null;

    const created = await products().create({
      data: {
        ...row,
        categories: { create: categoryIdsFrom(req.body).map((id) => ({ categoryId: id })) },
        variants: { create: toVariantRows(req.body.variants) },
      },
      include: FULL_INCLUDE,
    });

    invalidateProducts();
    res.send(productToApi(created));
  } catch (err) {
    fail(res, err);
  }
};

const addAllProducts = async (req, res) => {
  try {
    await products().deleteMany();
    for (const item of req.body || []) {
      if (!isUuid(item.category)) continue;
      const row = toRow(item);
      row.categoryId = item.category;
      row.petId = isUuid(item.pet) ? item.pet : null;
      row.brandId = isUuid(item.brand) ? item.brand : null;
      await products().create({
        data: {
          ...row,
          categories: { create: categoryIdsFrom(item).map((id) => ({ categoryId: id })) },
          variants: { create: toVariantRows(item.variants) },
        },
      });
    }
    invalidateAll();
    res.status(200).send({ message: "¡Producto agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getShowingProducts = async (req, res) => {
  try {
    const rows = await products().findMany({
      where: { status: "show" },
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(productToApi));
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Busca por texto en los campos multi-idioma. En Mongo eran regex por locale
 * (`title.es`, `title.en`…); aquí se compara el jsonb completo como texto con
 * ILIKE, que cubre todos los idiomas de una vez y sigue siendo insensible a
 * mayúsculas. Devuelve ids para luego cargarlos con sus relaciones.
 */
async function searchProductIds(term) {
  const like = `%${term}%`;
  const rows = await prisma().$queryRaw`
    SELECT DISTINCT p.id
    FROM products p
    LEFT JOIN brands b ON b.id = p."brandId"
    LEFT JOIN categories c ON c.id = p."categoryId"
    LEFT JOIN product_categories pc ON pc."productId" = p.id
    LEFT JOIN categories c2 ON c2.id = pc."categoryId"
    WHERE p.title::text ILIKE ${like}
       OR COALESCE(p.description::text, '') ILIKE ${like}
       OR EXISTS (SELECT 1 FROM unnest(p.tag) AS t WHERE t ILIKE ${like})
       OR COALESCE(b.name::text, '') ILIKE ${like}
       OR COALESCE(c.name::text, '') ILIKE ${like}
       OR COALESCE(c2.name::text, '') ILIKE ${like}`;
  return rows.map((r) => r.id);
}

const getAllProducts = async (req, res) => {
  try {
    const { title, category, price, page, limit } = req.query;

    const where = {};
    let orderBy = { createdAt: "desc" };

    if (title) {
      where.id = { in: await searchProductIds(String(title)) };
    }

    if (price === "low") orderBy = { originalPrice: "asc" };
    else if (price === "high") orderBy = { originalPrice: "desc" };
    else if (price === "published") where.status = "show";
    else if (price === "unPublished") where.status = "hide";
    else if (price === "status-selling") where.stock = { gt: 0 };
    else if (price === "status-out-of-stock") where.stock = { lt: 1 };
    else if (price === "date-added-asc") orderBy = { createdAt: "asc" };
    else if (price === "date-added-desc") orderBy = { createdAt: "desc" };
    else if (price === "date-updated-asc") orderBy = { updatedAt: "asc" };
    else if (price === "date-updated-desc") orderBy = { updatedAt: "desc" };

    if (category && isUuid(String(category))) {
      const cats = await prisma().category.findMany({ select: { id: true, parentId: true } });
      const ids = findDescendantCategoryIds(
        cats.map((c) => ({ _id: c.id, parentId: c.parentId })),
        category
      );
      if (ids.length > 0) {
        where.OR = [
          { categoryId: { in: ids } },
          { categories: { some: { categoryId: { in: ids } } } },
        ];
      }
    }

    const pages = Number(page) || 1;
    const limits = Number(limit) || 0;
    const skip = limits > 0 ? (pages - 1) * limits : undefined;

    const [totalDoc, rows] = await Promise.all([
      products().count({ where }),
      products().findMany({
        where,
        include: FULL_INCLUDE,
        orderBy,
        ...(skip ? { skip } : {}),
        ...(limits > 0 ? { take: limits } : {}),
      }),
    ]);

    res.send({ products: rows.map(productToApi), totalDoc, limits, pages });
  } catch (err) {
    fail(res, err);
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    // Clave propia: `product:slug:` guarda el envoltorio de la tienda
    // ({products, relatedProducts, …}), no una ficha suelta. Compartirla hacía
    // que el primero en poblar el caché devolviera la forma equivocada al otro.
    const cacheKey = `product:detail:${slug}`;

    const { data, fromCache } = await cache.getOrFetch(cacheKey, async () => {
      const row = await products().findUnique({ where: { slug }, include: FULL_INCLUDE });
      return row ? productToApi(row) : null;
    });

    cache.setCacheHeaders(res, fromCache, cache.resolveTTL(cacheKey));
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: `Slug problem, ${err.message}` });
  }
};

const getProductById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Producto no encontrado!");
    const row = await products().findUnique({
      where: { id: req.params.id },
      include: FULL_INCLUDE,
    });
    if (!row) return notFound(res, "¡Producto no encontrado!");
    res.send(productToApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateProduct = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Producto no encontrado!");
    const current = await products().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "¡Producto no encontrado!");

    const data = toRow(req.body);

    // Los textos multi-idioma se fusionan: el panel edita un idioma a la vez.
    const MERGE_FIELDS = [
      "title", "description", "benefits", "features", "ingredients",
      "feedingGuide", "indications", "warnings", "dosage",
      "recommendedFor", "brandInfo",
    ];
    for (const field of MERGE_FIELDS) {
      if (req.body[field] !== undefined) {
        data[field] = { ...(current[field] || {}), ...(req.body[field] || {}) };
      }
    }

    if (req.body.category !== undefined && isUuid(req.body.category)) {
      data.categoryId = req.body.category;
    }
    if (req.body.pet !== undefined) data.petId = isUuid(req.body.pet) ? req.body.pet : null;
    if (req.body.brand !== undefined) data.brandId = isUuid(req.body.brand) ? req.body.brand : null;

    const oldSlug = current.slug;

    // Categorías y variantes se reemplazan por completo, que es la semántica
    // que tenían al ser arrays embebidos.
    const updated = await prisma().$transaction(async (tx) => {
      if (req.body.categories !== undefined || req.body.category !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: req.params.id } });
        const ids = categoryIdsFrom(req.body);
        if (ids.length) {
          await tx.productCategory.createMany({
            data: ids.map((id) => ({ productId: req.params.id, categoryId: id })),
          });
        }
      }

      if (req.body.variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
        const rows = toVariantRows(req.body.variants);
        if (rows.length) {
          await tx.productVariant.createMany({
            data: rows.map((v) => ({ ...v, productId: req.params.id })),
          });
        }
      }

      return tx.product.update({
        where: { id: req.params.id },
        data,
        include: FULL_INCLUDE,
      });
    });

    invalidateProductBySlug(oldSlug);
    if (req.body.slug) invalidateProductBySlug(req.body.slug);
    invalidateProducts();

    res.send({ data: productToApi(updated), message: "¡Producto actualizado correctamente!" });
  } catch (err) {
    res.status(404).send(err.message);
  }
};

const updateManyProducts = async (req, res) => {
  try {
    const data = toRow(req.body);
    // Sólo campos escalares: nombres, variantes y categorías no tienen sentido
    // aplicados en bloque.
    delete data.title;
    delete data.description;
    delete data.slug;

    await products().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    invalidateProducts();
    res.send({ message: "¡Productos actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Producto no encontrado!");
    const status = req.body.status;
    await products().update({ where: { id: req.params.id }, data: { status } });
    invalidateProducts();
    res.status(200).send({ message: `¡Producto ${status} correctamente!` });
  } catch (err) {
    fail(res, err);
  }
};

const deleteProduct = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Producto no encontrado!");
    await products().delete({ where: { id: req.params.id } });
    invalidateProducts();
    res.status(200).send({ message: "¡Producto eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyProducts = async (req, res) => {
  try {
    await products().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    invalidateProducts();
    res.send({ message: "¡Productos eliminados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getShowingStoreProducts = async (req, res) => {
  try {
    const { category, title, slug, pet, brand } = req.query;

    if (title && title.length > 100) {
      return res
        .status(400)
        .send({ message: "Búsqueda demasiado larga (máximo 100 caracteres)." });
    }

    const isAdminUser =
      req.user && (req.user.role === "Admin" || req.user.role === "Super Admin");
    if (isAdminUser) cache.trackBypass();

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

    if (!isAdminUser) {
      const { data: cached, fromCache } = await cache.getOrFetch(
        cacheKey,
        () => executeStoreQuery({ category, title, slug, pet, brand }),
        ttl
      );
      cache.setCacheHeaders(res, fromCache, ttl);
      return res.send(cached);
    }

    const data = await executeStoreQuery({ category, title, slug, pet, brand });
    cache.setCacheHeaders(res, false, 0, "admin");
    res.send(data);
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Consulta real de la tienda. Se extrajo para servir tanto al fallo de caché
 * como al bypass de administrador.
 */
async function executeStoreQuery({ category, title, slug, pet, brand }) {
  const where = { status: "show" };

  if (pet && isUuid(String(pet))) where.petId = String(pet);
  if (brand && isUuid(String(brand))) where.brandId = String(brand);
  if (slug) where.slug = { contains: String(slug), mode: "insensitive" };
  if (title) where.id = { in: await searchProductIds(String(title)) };

  if (category && isUuid(String(category))) {
    const cats = await prisma().category.findMany({
      where: { status: "show" },
      select: { id: true, parentId: true },
    });
    const ids = findDescendantCategoryIds(
      cats.map((c) => ({ _id: c.id, parentId: c.parentId })),
      category
    );
    if (ids.length > 0) {
      where.OR = [
        { categoryId: { in: ids } },
        { categories: { some: { categoryId: { in: ids } } } },
      ];
    }
  }

  let productRows = [];
  let popularProducts = [];
  let discountedProducts = [];
  let relatedProducts = [];
  let reviews = [];

  if (slug) {
    productRows = await products().findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const first = productRows[0];
    if (first) {
      relatedProducts = await products().findMany({
        where: { categoryId: first.categoryId, id: { not: first.id }, status: "show" },
        include: FULL_INCLUDE,
      });
      reviews = await prisma().review.findMany({
        where: { productId: first.id, status: "approved" },
        include: { customer: { select: { id: true, name: true, image: true } } },
      });
    }
  } else if (title || category || pet || brand) {
    productRows = await products().findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } else {
    [productRows, popularProducts, discountedProducts] = await Promise.all([
      products().findMany({
        where: { status: "show" },
        include: FULL_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      products().findMany({
        where: { status: "show" },
        include: FULL_INCLUDE,
        orderBy: { sales: "desc" },
        take: 20,
      }),
      // El descuento ahora es numérico: antes se comparaba contra el string
      // "0.00", lo que dejaba fuera casos como "0.5".
      products().findMany({
        where: {
          status: "show",
          OR: [
            { isCombination: true, variants: { some: { discount: { gt: 0 } } } },
            { isCombination: false, discount: { gt: 0 } },
          ],
        },
        include: FULL_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
  }

  const { reviewToApi } = require("../lib/prisma/presenters");

  return {
    reviews: reviews.map(reviewToApi),
    products: productRows.map(productToApi),
    popularProducts: popularProducts.map(productToApi),
    relatedProducts: relatedProducts.map(productToApi),
    discountedProducts: discountedProducts.map(productToApi),
  };
}

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
