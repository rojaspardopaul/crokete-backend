import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./openapi";

// Importing the contract modules executes registry.register(...) for every
// schema. Importing the paths module registers the HTTP operations.
import "./catalog";
import { registerProductPaths } from "./catalog/product.paths";

/**
 * Builds the OpenAPI 3 document from the Zod registry and writes openapi.json.
 *
 * Run with: npm run openapi:gen
 * This JSON is the language-agnostic source of truth consumed by:
 *   - npm run sdk:gen           (TypeScript types/client)
 *   - openapi-generator-cli ... (Python / Angular clients — see src/sdk/README.md)
 */
function generate(): void {
  registerProductPaths();

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Crokete API",
      version: "2.0.0",
      description:
        "Contract generated from Zod schemas (single source of truth). " +
        "Reference catalog module for the Crokete V2 / SaaS architecture.",
    },
    servers: [
      { url: "http://localhost:5055/v1", description: "Local" },
      { url: "{baseUrl}", description: "Configurable", variables: { baseUrl: { default: "https://api.crokete.com/v1" } } },
    ],
  });

  const outPath = resolve(process.cwd(), "openapi.json");
  writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`✅ openapi.json written to ${outPath}`);
}

generate();
