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

/** Mongo ObjectId rendered as a 24-char hex string over the wire. */
export const ObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
  .openapi({ example: "665f1b2c3d4e5f6a7b8c9d0e" });

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
