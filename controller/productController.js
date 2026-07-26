const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");
const cache = require("../utils/cache");
const {
  invalidateProducts,
  invalidateProductBySlug,
  invalidateAll,
} = require("../lib/cache/invalidation");
const catalog = require("../lib/prisma/catalog");

/**
 * Los manejadores sólo traducen HTTP ↔ dominio: las consultas viven en
 * lib/prisma/catalog para que el módulo TypeScript (USE_TS_CATALOG) ejecute
 * exactamente las mismas y no puedan divergir.
 */

const addProduct = async (req, res) => {
  try {
    if (!isUuid(req.body.category)) {
      return res.status(400).send({ message: "La categoría del producto no es válida." });
    }
    const product = await catalog.createProduct(req.body);
    invalidateProducts();
    res.send(product);
  } catch (err) {
    fail(res, err);
  }
};

const addAllProducts = async (req, res) => {
  try {
    await catalog.replaceAllProducts(req.body || []);
    invalidateAll();
    res.status(200).send({ message: "¡Producto agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getShowingProducts = async (req, res) => {
  try {
    res.send(await catalog.findShowingProducts());
  } catch (err) {
    fail(res, err);
  }
};

const getAllProducts = async (req, res) => {
  try {
    const { title, category, price, page, limit } = req.query;
    res.send(await catalog.listProductsAdmin({ title, category, price, page, limit }));
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

    const { data, fromCache } = await cache.getOrFetch(cacheKey, () =>
      catalog.findProductBySlug(slug)
    );

    cache.setCacheHeaders(res, fromCache, cache.resolveTTL(cacheKey));
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: `Slug problem, ${err.message}` });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await catalog.findProductById(req.params.id);
    if (!product) return notFound(res, "¡Producto no encontrado!");
    res.send(product);
  } catch (err) {
    fail(res, err);
  }
};

const updateProduct = async (req, res) => {
  try {
    const result = await catalog.updateProductById(req.params.id, req.body);
    if (!result) return notFound(res, "¡Producto no encontrado!");

    invalidateProductBySlug(result.previousSlug);
    if (req.body.slug) invalidateProductBySlug(req.body.slug);
    invalidateProducts();

    res.send({ data: result.product, message: "¡Producto actualizado correctamente!" });
  } catch (err) {
    res.status(404).send(err.message);
  }
};

const updateManyProducts = async (req, res) => {
  try {
    await catalog.updateManyProducts(uuidList(req.body.ids), req.body);
    invalidateProducts();
    res.send({ message: "¡Productos actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    const status = req.body.status;
    const ok = await catalog.setProductStatus(req.params.id, status);
    if (!ok) return notFound(res, "¡Producto no encontrado!");
    invalidateProducts();
    res.status(200).send({ message: `¡Producto ${status} correctamente!` });
  } catch (err) {
    fail(res, err);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const ok = await catalog.deleteProductById(req.params.id);
    if (!ok) return notFound(res, "¡Producto no encontrado!");
    invalidateProducts();
    res.status(200).send({ message: "¡Producto eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyProducts = async (req, res) => {
  try {
    await catalog.deleteProducts(uuidList(req.body.ids));
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
        () => catalog.executeStoreQuery({ category, title, slug, pet, brand }),
        ttl
      );
      cache.setCacheHeaders(res, fromCache, ttl);
      return res.send(cached);
    }

    const data = await catalog.executeStoreQuery({ category, title, slug, pet, brand });
    cache.setCacheHeaders(res, false, 0, "admin");
    res.send(data);
  } catch (err) {
    fail(res, err);
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
