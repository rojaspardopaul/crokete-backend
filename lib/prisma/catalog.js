/**
 * Acceso a datos del catálogo sobre Postgres.
 *
 * Vive aquí, y no dentro del controlador, porque hay dos entradas al mismo
 * catálogo: los manejadores JS de `controller/productController.js` y el módulo
 * TypeScript/DDD (`src/modules/catalog`), que se activa con USE_TS_CATALOG. Con
 * una consulta escrita dos veces, la tienda recibiría una forma distinta según
 * qué módulo respondiera —justo el fallo que ya apareció al compartir la clave
 * de caché `product:slug:`—, así que ambas rutas ejecutan estas funciones.
 *
 * Traduce además entre el cuerpo heredado de la API (`prices`, `variants`,
 * `petCompatibility` anidados) y el esquema normalizado.
 */
const { getPrisma } = require("./index");
const { productToApi, reviewToApi } = require("./presenters");
const { isUuid } = require("./helpers");
const { findDescendantCategoryIds } = require("../../utils/categoryHierarchy");

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

/** Textos multi-idioma: el panel edita un idioma a la vez, así que se fusionan. */
const MERGE_FIELDS = [
  "title", "description", "benefits", "features", "ingredients",
  "feedingGuide", "indications", "warnings", "dosage",
  "recommendedFor", "brandInfo",
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

/** Referencias del cuerpo → claves foráneas. */
function relationsFrom(body, { partial = false } = {}) {
  const row = {};
  if (!partial || body.category !== undefined) {
    if (isUuid(body.category)) row.categoryId = body.category;
  }
  if (!partial || body.pet !== undefined) {
    row.petId = isUuid(body.pet) ? body.pet : null;
  }
  if (!partial || body.brand !== undefined) {
    row.brandId = isUuid(body.brand) ? body.brand : null;
  }
  return row;
}

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

/** Ids de una categoría y toda su descendencia. */
async function descendantCategoryIds(categoryId, { onlyVisible = false } = {}) {
  if (!isUuid(String(categoryId))) return [];
  const cats = await prisma().category.findMany({
    ...(onlyVisible ? { where: { status: "show" } } : {}),
    select: { id: true, parentId: true },
  });
  return findDescendantCategoryIds(
    cats.map((c) => ({ _id: c.id, parentId: c.parentId })),
    categoryId
  );
}

// ─── Lecturas ────────────────────────────────────────────────────────────────

async function findProductById(id) {
  if (!isUuid(id)) return null;
  const row = await products().findUnique({ where: { id }, include: FULL_INCLUDE });
  return row ? productToApi(row) : null;
}

async function findProductBySlug(slug) {
  const row = await products().findUnique({ where: { slug }, include: FULL_INCLUDE });
  return row ? productToApi(row) : null;
}

async function findShowingProducts() {
  const rows = await products().findMany({
    where: { status: "show" },
    include: FULL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(productToApi);
}

/** Listado del panel con búsqueda, filtro por categoría y ordenación. */
async function listProductsAdmin({ title, category, price, page, limit } = {}) {
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

  if (category) {
    const ids = await descendantCategoryIds(category);
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

  return { products: rows.map(productToApi), totalDoc, limits, pages };
}

/**
 * Consulta de la tienda: portada, búsqueda, filtros y ficha por slug. Es la
 * misma que precarga el caché al arrancar (lib/cache/warming).
 */
async function executeStoreQuery({ category, title, slug, pet, brand } = {}) {
  const where = { status: "show" };

  if (pet && isUuid(String(pet))) where.petId = String(pet);
  if (brand && isUuid(String(brand))) where.brandId = String(brand);
  if (slug) where.slug = { contains: String(slug), mode: "insensitive" };
  if (title) where.id = { in: await searchProductIds(String(title)) };

  if (category) {
    const ids = await descendantCategoryIds(category, { onlyVisible: true });
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

  return {
    reviews: reviews.map(reviewToApi),
    products: productRows.map(productToApi),
    popularProducts: popularProducts.map(productToApi),
    relatedProducts: relatedProducts.map(productToApi),
    discountedProducts: discountedProducts.map(productToApi),
  };
}

// ─── Escrituras ──────────────────────────────────────────────────────────────

/** Alta de producto con sus categorías y variantes. */
async function createProduct(body) {
  const row = { ...toRow(body), ...relationsFrom(body) };
  const created = await products().create({
    data: {
      ...row,
      categories: { create: categoryIdsFrom(body).map((id) => ({ categoryId: id })) },
      variants: { create: toVariantRows(body.variants) },
    },
    include: FULL_INCLUDE,
  });
  return productToApi(created);
}

/**
 * Actualiza un producto. Categorías y variantes se reemplazan por completo, que
 * es la semántica que tenían al ser arrays embebidos.
 */
async function updateProductById(id, body) {
  if (!isUuid(id)) return null;
  const current = await products().findUnique({ where: { id } });
  if (!current) return null;

  const data = { ...toRow(body), ...relationsFrom(body, { partial: true }) };

  for (const field of MERGE_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = { ...(current[field] || {}), ...(body[field] || {}) };
    }
  }

  const updated = await prisma().$transaction(async (tx) => {
    if (body.categories !== undefined || body.category !== undefined) {
      await tx.productCategory.deleteMany({ where: { productId: id } });
      const ids = categoryIdsFrom(body);
      if (ids.length) {
        await tx.productCategory.createMany({
          data: ids.map((categoryId) => ({ productId: id, categoryId })),
        });
      }
    }

    if (body.variants !== undefined) {
      await tx.productVariant.deleteMany({ where: { productId: id } });
      const rows = toVariantRows(body.variants);
      if (rows.length) {
        await tx.productVariant.createMany({
          data: rows.map((v) => ({ ...v, productId: id })),
        });
      }
    }

    return tx.product.update({ where: { id }, data, include: FULL_INCLUDE });
  });

  return { product: productToApi(updated), previousSlug: current.slug };
}

/**
 * Alta o actualización según exista el id. La usa el repositorio del módulo
 * DDD, cuyo agregado genera su propia identidad antes de guardar.
 */
async function saveProductDoc(doc) {
  const id = doc._id || doc.id;
  if (isUuid(id)) {
    const existing = await products().findUnique({ where: { id }, select: { id: true } });
    if (existing) {
      const result = await updateProductById(id, doc);
      return result ? result.product : null;
    }
  }

  const row = { ...toRow(doc), ...relationsFrom(doc) };
  const created = await products().create({
    data: {
      ...(isUuid(id) ? { id } : {}),
      ...row,
      categories: { create: categoryIdsFrom(doc).map((categoryId) => ({ categoryId })) },
      variants: { create: toVariantRows(doc.variants) },
    },
    include: FULL_INCLUDE,
  });
  return productToApi(created);
}

/** Reemplaza el catálogo entero (equivalente al alta masiva heredada). */
async function replaceAllProducts(docs) {
  await products().deleteMany();
  for (const doc of docs || []) {
    if (!isUuid(doc.category)) continue;
    await saveProductDoc({ ...doc, _id: undefined });
  }
}

/** Aplica los mismos campos escalares a varios productos. */
async function updateManyProducts(ids, body) {
  const data = toRow(body);
  // Nombres, variantes y categorías no tienen sentido aplicados en bloque.
  delete data.title;
  delete data.description;
  delete data.slug;
  await products().updateMany({ where: { id: { in: ids } }, data });
}

async function setProductStatus(id, status) {
  if (!isUuid(id)) return false;
  const updated = await products().updateMany({ where: { id }, data: { status } });
  return updated.count > 0;
}

async function deleteProductById(id) {
  if (!isUuid(id)) return false;
  const deleted = await products().deleteMany({ where: { id } });
  return deleted.count > 0;
}

async function deleteProducts(ids) {
  await products().deleteMany({ where: { id: { in: ids } } });
}

module.exports = {
  FULL_INCLUDE,
  toRow,
  toVariantRows,
  categoryIdsFrom,
  searchProductIds,
  descendantCategoryIds,
  findProductById,
  findProductBySlug,
  findShowingProducts,
  listProductsAdmin,
  executeStoreQuery,
  createProduct,
  updateProductById,
  saveProductDoc,
  replaceAllProducts,
  updateManyProducts,
  setProductStatus,
  deleteProductById,
  deleteProducts,
};
