# Crokete SDK / Client codegen

`openapi.json` (generated from the Zod contracts via `npm run openapi:gen`) is the
**single, language-agnostic source of truth** for the API. Clients for every
consumer are generated from it — no hand-written API types anywhere.

## TypeScript (admin / store / future TS apps)

```bash
npm run openapi:gen        # Zod -> openapi.json
npm run sdk:gen            # openapi.json -> src/sdk/generated/types.ts
```

`src/sdk/generated/types.ts` contains the typed request/response shapes. Pair it
with a tiny fetch wrapper (or `openapi-fetch`) to get an end-to-end typed client.

## Python (future SaaS backend/scripts)

```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g python \
  -o ./clients/python
```

## Angular (future SaaS admin, if Angular is chosen)

```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-angular \
  -o ./clients/angular
```

> The Python/Angular generators are documented but not run here — they are the
> tooling the SaaS inherits. The TS generation (`sdk:gen`) IS wired so the
> pattern is proven end-to-end.
