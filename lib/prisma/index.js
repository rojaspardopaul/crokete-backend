/**
 * Prisma Client singleton (PostgreSQL / Supabase).
 *
 * One instance per process: each PrismaClient owns a connection pool, so
 * constructing it per request would exhaust Postgres connections.
 *
 * The generated client lives under src/generated/prisma (TypeScript) and is
 * compiled to dist/generated/prisma by `npm run build:ts` — the same
 * src → dist pipeline the DDD modules already use. Production always has dist/;
 * `npm run dev` needs a build first, hence the explicit error below instead of
 * a confusing MODULE_NOT_FOUND.
 */
const { PrismaPg } = require("@prisma/adapter-pg");

let cachedPrisma = null;

function loadPrismaClient() {
  try {
    return require("../../dist/generated/prisma/client.js").PrismaClient;
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    throw new Error(
      "Prisma Client no compilado. Ejecuta `npm run build:ts` (genera dist/generated/prisma)."
    );
  }
}

/**
 * @returns {import("../../dist/generated/prisma/client.js").PrismaClient}
 */
function getPrisma() {
  if (cachedPrisma) return cachedPrisma;

  if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL (cadena de conexión de Supabase Postgres).");
  }

  const PrismaClient = loadPrismaClient();
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  cachedPrisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

  return cachedPrisma;
}

/** Closes the pool. Used by the graceful-shutdown handler in api/index.js. */
async function disconnectPrisma() {
  if (!cachedPrisma) return;
  await cachedPrisma.$disconnect();
  cachedPrisma = null;
}

module.exports = { getPrisma, disconnectPrisma };
