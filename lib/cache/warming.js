const cache = require("../../utils/cache");
const { executeStoreQuery } = require("../prisma/catalog");

/**
 * Precarga el cache con la consulta más frecuente: la portada de la tienda.
 * Se ejecuta una sola vez al iniciar el servidor.
 *
 * Usa la misma función que sirve el endpoint, así que lo que queda en
 * `products:home` es exactamente lo que devolvería una petición real. Antes se
 * repetía aquí la consulta con otros `populate`, de modo que la respuesta
 * cambiaba de forma según si venía del arranque o de la primera visita.
 *
 * El árbol de categorías ya no se precarga: el endpoint que lo servía se
 * declara `no-store` porque incluye marcas relacionadas, que dependen de
 * relaciones producto-marca vivas.
 */
async function warmCache() {
  try {
    const homeData = await executeStoreQuery({});
    cache.set("products:home", homeData, 60);
    console.log(
      `  🔥 Cache warmed: home (${homeData.products?.length ?? 0} productos, ` +
        `${homeData.popularProducts?.length ?? 0} populares, ` +
        `${homeData.discountedProducts?.length ?? 0} descuento)`
    );
  } catch (err) {
    console.error("  ⚠️  Error en cache warming:", err.message);
  }
}

module.exports = { warmCache };
