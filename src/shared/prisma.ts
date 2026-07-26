import type { PrismaClient } from "../generated/prisma/client";

/**
 * Cliente Prisma para los módulos TypeScript.
 *
 * Se toma prestado el singleton de `lib/prisma`, el mismo que usan los
 * controladores JS: cada `PrismaClient` abre su propio pool de conexiones, así
 * que instanciar otro aquí duplicaría las conexiones contra Postgres dentro del
 * mismo proceso.
 *
 * El `require` es en tiempo de ejecución porque ese módulo es CommonJS y vive
 * fuera de `src/`; el tipo sí se importa, de modo que las consultas de estos
 * adaptadores siguen comprobadas por el compilador.
 */
export function prisma(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getPrisma } = require("../../lib/prisma") as {
    getPrisma: () => PrismaClient;
  };
  return getPrisma();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres rechaza un uuid mal formado con un error de tipo (500). Se valida
 * antes de consultar para poder responder "no encontrado" como hacía Mongo.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Filtra una lista de ids quedándose sólo con los uuid válidos. */
export function uuidList(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter(isUuid);
}
