import { z, registry } from "./openapi";

/**
 * Multi-language text: an object keyed by locale, e.g. { es: "Pienso", en: "Dog food" }.
 * Formalises the legacy "plain Object with locale keys" pattern used across
 * Product/Category/Brand.
 */
export const MultiLangTextSchema = registry.register(
  "MultiLangText",
  z
    .record(z.string(), z.string())
    .openapi({ example: { es: "Pienso para perros", en: "Dog food" } })
);
export type MultiLangText = z.infer<typeof MultiLangTextSchema>;

/**
 * Identificador de recurso: un uuid v4, que es lo que usan las claves primarias
 * de Postgres. Antes exigía un ObjectId de Mongo (24 hex), de modo que tras la
 * migración el contrato rechazaba cualquier id real de la base.
 */
export const IdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Identificador no válido"
  )
  .openapi({ example: "3f1b9f0c-7a1e-4d2b-9f3a-2c8e5d6b7a10" });


/** Standard error envelope returned by the API. */
export const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  })
);
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
