const NodeCache = require("node-cache");

// ─── Configuración ──────────────────────────────────────────────
const DEFAULT_TTL = 60; // segundos
const MAX_KEYS = 500;
const MAX_VALUE_SIZE = 1_048_576; // 1 MB
const STATS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const METRICS_WEIGHT = { "products:home": 3, search: 3, "product:slug": 3 };

// TTL por prefijo de key
const TTL_MAP = {
  "search:": 30,
  "products:": 60,
  "product:slug:": 300,
  "categories:": 600,
};

// ─── Instancia node-cache ───────────────────────────────────────
const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 120,
  useClones: false,  // performance: no deep-clone en get/set
  maxKeys: MAX_KEYS,
});

// ─── Métricas ───────────────────────────────────────────────────
const metrics = { hits: 0, misses: 0, bypasses: 0, evictions: 0 };

cache.on("del", () => { metrics.evictions++; });

// Log periódico
setInterval(() => {
  const total = metrics.hits + metrics.misses;
  if (total === 0) return;
  const ratio = ((metrics.hits / total) * 100).toFixed(1);

  // Estimar queries MongoDB evitadas (ponderado por tipo de endpoint)
  const saved = metrics.hits; // mínimo 1 query evitada por hit
  console.log(
    `📊 Cache: hits=${metrics.hits} misses=${metrics.misses} ratio=${ratio}% ` +
    `keys=${cache.keys().length} bypasses=${metrics.bypasses} queries_evitadas≈${saved}`
  );
}, STATS_INTERVAL_MS);

// ─── Request coalescing ─────────────────────────────────────────
// Si múltiples requests piden la misma key simultáneamente,
// solo una ejecuta la query real. Las demás esperan el mismo Promise.
const pending = new Map();

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Resuelve el TTL correcto según el prefijo de la key.
 */
function resolveTTL(key, explicitTTL) {
  if (explicitTTL != null) return explicitTTL;
  for (const [prefix, ttl] of Object.entries(TTL_MAP)) {
    if (key.startsWith(prefix)) return ttl;
  }
  return DEFAULT_TTL;
}

/**
 * Normaliza parámetros de query para generar cache keys consistentes.
 * - lowercase, trim, colapsa espacios múltiples
 * - ordena params alfabéticamente
 */
function buildCacheKey(prefix, params = {}) {
  const parts = Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== "")
    .sort()
    .map((k) => {
      const v = String(params[k]).toLowerCase().trim().replace(/\s+/g, " ");
      return `${k}=${v}`;
    });

  if (parts.length === 0) return prefix;
  return `${prefix}:${parts.join(":")}`;
}

// ─── API pública ────────────────────────────────────────────────

/**
 * Cache-first con request coalescing.
 *
 * @param {string} key - Cache key (usar buildCacheKey para generar)
 * @param {Function} fetchFn - Función async que ejecuta la query a MongoDB
 * @param {number} [ttl] - TTL en segundos (si no se pasa, se resuelve por prefijo)
 * @returns {{ data: any, fromCache: boolean }}
 */
async function getOrFetch(key, fetchFn, ttl) {
  // 1. Cache hit
  const cached = cache.get(key);
  if (cached !== undefined) {
    metrics.hits++;
    return { data: cached, fromCache: true };
  }

  // 2. Request coalescing: si ya hay un fetch en vuelo para esta key, esperar
  if (pending.has(key)) {
    const data = await pending.get(key);
    metrics.hits++; // se contabiliza como hit (no generó query adicional)
    return { data, fromCache: true };
  }

  // 3. Cache miss: ejecutar fetch
  metrics.misses++;
  const resolvedTTL = resolveTTL(key, ttl);

  const promise = fetchFn();
  pending.set(key, promise);

  try {
    const data = await promise;

    // Protección: no cachear valores demasiado grandes
    const size = Buffer.byteLength(JSON.stringify(data), "utf8");
    if (size <= MAX_VALUE_SIZE) {
      cache.set(key, data, resolvedTTL);
    }

    return { data, fromCache: false };
  } finally {
    pending.delete(key);
  }
}

/**
 * Obtener valor del cache (sin fetch).
 */
function get(key) {
  return cache.get(key);
}

/**
 * Guardar valor en cache.
 */
function set(key, value, ttl) {
  const resolvedTTL = resolveTTL(key, ttl);
  cache.set(key, value, resolvedTTL);
}

/**
 * Borrar una key exacta.
 */
function del(key) {
  cache.del(key);
}

/**
 * Borrar todas las keys que empiezan con el prefijo dado.
 */
function delByPrefix(prefix) {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length > 0) cache.del(keys);
  return keys.length;
}

/**
 * Flush completo del cache.
 */
function flush() {
  cache.flushAll();
}

/**
 * Estadísticas del cache.
 */
function getStats() {
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    bypasses: metrics.bypasses,
    hitRatio: total > 0 ? `${((metrics.hits / total) * 100).toFixed(1)}%` : "0%",
    keys: cache.keys().length,
    maxKeys: MAX_KEYS,
  };
}

/**
 * Registrar bypass (admin, etc.).
 */
function trackBypass() {
  metrics.bypasses++;
}

/**
 * Setear headers HTTP de cache en la response.
 * @param {object} res - Express response
 * @param {boolean} fromCache - si vino del cache
 * @param {number} ttl - TTL usado
 * @param {string} [bypass] - si fue bypass (admin)
 */
function setCacheHeaders(res, fromCache, ttl, bypass) {
  if (bypass) {
    res.set("X-Cache", "BYPASS");
    res.set("Cache-Control", "no-store");
    return;
  }
  res.set("X-Cache", fromCache ? "HIT" : "MISS");
  res.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=10`);
}

module.exports = {
  getOrFetch,
  get,
  set,
  del,
  delByPrefix,
  flush,
  getStats,
  trackBypass,
  setCacheHeaders,
  buildCacheKey,
  resolveTTL,
};
