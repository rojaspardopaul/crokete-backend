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

export const registry = new OpenAPIRegistry();
export { z };
