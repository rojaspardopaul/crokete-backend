const cache = require("../../utils/cache");

function clearProductCacheKeys() {
  const d1 = cache.delByPrefix("products:");
  const d2 = cache.delByPrefix("search:");
  // Dos formas distintas por slug: el envoltorio de la tienda
  // (product:slug:) y la ficha suelta (product:detail:).
  const d3 = cache.delByPrefix("product:slug:");
  const d4 = cache.delByPrefix("product:detail:");

  return d1 + d2 + d3 + d4;
}

function clearCategoryCacheKeys() {
  return cache.delByPrefix("categories:");
}

/**
 * Invalida todo el cache de productos y búsquedas.
 * Llamar después de crear, actualizar o eliminar productos.
 */
function invalidateProducts() {
  const productKeys = clearProductCacheKeys();
  const categoryKeys = clearCategoryCacheKeys();
  console.log(
    `🗑️  Cache invalidado: productos (${productKeys} keys), categorías relacionadas (${categoryKeys} keys)`
  );
}

/**
 * Invalida el cache de un producto específico por slug, en sus dos formas:
 * el envoltorio que sirve la tienda y la ficha individual.
 */
function invalidateProductBySlug(slug) {
  if (!slug) return;
  cache.del(`product:slug:${slug}`);
  cache.del(`product:detail:${slug}`);
}

/**
 * Invalida todo el cache de categorías.
 * También invalida productos porque la búsqueda depende de nombres de categoría.
 */
function invalidateCategories() {
  const categoryKeys = clearCategoryCacheKeys();
  console.log(`🗑️  Cache invalidado: categorías (${categoryKeys} keys)`);
  // Los productos dependen de categorías en el search (matchingCategories)
  const productKeys = clearProductCacheKeys();
  console.log(`🗑️  Cache invalidado: productos dependientes (${productKeys} keys)`);
}

/**
 * Invalida caches afectados por cambios en marcas.
 * Afecta listados de productos, búsquedas y el menú de categorías con marcas relacionadas.
 */
function invalidateBrands() {
  const categoryKeys = clearCategoryCacheKeys();
  const productKeys = clearProductCacheKeys();
  console.log(
    `🗑️  Cache invalidado: marcas -> categorías (${categoryKeys} keys), productos (${productKeys} keys)`
  );
}

/**
 * Flush completo del cache. Usar en operaciones bulk (addAll).
 */
function invalidateAll() {
  cache.flush();
  console.log("🗑️  Cache invalidado: FLUSH COMPLETO");
}

/**
 * Invalida caches de reseñas.
 * También invalida productos porque el rating promedio depende de las reseñas aprobadas.
 */
function invalidateReviews() {
  const reviewKeys = cache.delByPrefix("reviews:");
  const productKeys = clearProductCacheKeys();
  console.log(
    `🗑️  Cache invalidado: reseñas (${reviewKeys} keys), productos dependientes (${productKeys} keys)`
  );
}

module.exports = {
  invalidateProducts,
  invalidateProductBySlug,
  invalidateCategories,
  invalidateBrands,
  invalidateAll,
  invalidateReviews,
};
