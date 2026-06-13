import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

/**
 * Single place where Zod is extended with `.openapi()` metadata support and
 * where the shared registry lives. Every contract module imports `z` and
 * `registry` from here so all schemas/paths land in one OpenAPI document.
 *
 * This file makes the Zod schemas — not hand-written YAML — the single source
 * of truth for the API contract. `npm run openapi:gen` turns the registry into
 * `openapi.json`, from which TS / Python / Angular clients are generated.
 */
extendZodWithOpenApi(z);

// ─── Spanish error messages for all Zod validation ──────────────────────────
// Set globally so contract validation surfaces Spanish messages in the admin
// (e.g. "Se esperaba número, se recibió texto" instead of the English default).
const TYPE_ES: Record<string, string> = {
  string: "texto",
  number: "número",
  boolean: "booleano",
  array: "lista",
  object: "objeto",
  date: "fecha",
  integer: "entero",
};

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "Campo requerido." };
      }
      return {
        message: `Se esperaba ${TYPE_ES[issue.expected] ?? issue.expected}, se recibió ${
          TYPE_ES[issue.received] ?? issue.received
        }.`,
      };
    case z.ZodIssueCode.too_small:
      return {
        message:
          issue.type === "string"
            ? `Debe tener al menos ${issue.minimum} carácter(es).`
            : `Debe ser mayor o igual a ${issue.minimum}.`,
      };
    case z.ZodIssueCode.too_big:
      return {
        message:
          issue.type === "string"
            ? `Debe tener como máximo ${issue.maximum} carácter(es).`
            : `Debe ser menor o igual a ${issue.maximum}.`,
      };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Valor no válido." };
    case z.ZodIssueCode.invalid_string:
      return { message: "Formato no válido." };
    default:
      return { message: ctx.defaultError };
  }
});

export const registry = new OpenAPIRegistry();
export { z };
