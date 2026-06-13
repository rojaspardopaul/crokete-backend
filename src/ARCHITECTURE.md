# `src/` — Crokete V2 reference architecture (pattern lab)

This directory is the **TypeScript + DDD reference implementation** described in
the Crokete V2 plan. It exists to:

1. Validate the DDD + TS + OpenAPI-first pattern on real Crokete code.
2. Extract reusable building blocks for the future multi-tenant SaaS.

**Production is untouched.** The legacy app (`controller/`, `models/`, `routes/`,
`lib/`) keeps running exactly as before. `npm run dev` / `npm start` are
unchanged. Nothing in `src/` is wired into `api/index.js` yet.

## Layout

```
src/
  shared/                     → future @crokete/core (kernel)
    kernel/                   Entity, ValueObject, AggregateRoot, Result
    errors/                   DomainError taxonomy + HTTP mapping
    events/                   DomainEvent + in-memory EventBus
    logger.ts                 Pino structured logger
  contracts/                  → future @crokete/contracts (single source of truth)
    openapi.ts, shared.ts     Zod registry + shared schemas
    catalog/                  Zod DTOs + OpenAPI path definitions
    generate-openapi.ts       Zod -> openapi.json
  sdk/                        → future @crokete/sdk (generated clients)
    generated/types.ts        openapi.json -> TS types
    README.md                 Python / Angular codegen instructions
  modules/
    catalog/                  Reference DDD module (the "gold" example)
      domain/                 entities, value-objects, events, repository iface
      application/            use-cases, ports, dto-mapper
      infrastructure/         mongoose model, mapper, repository, cache, read
      presentation/           controller, routes
      CatalogModule.ts        composition root
    orders/                   Order aggregate + MarkOrderPaid + OrdersModule wiring
    inventory/                OrderPaid subscriber: decrement stock
    loyalty/                  OrderPaid subscriber: grant points
    notifications/            OrderPaid subscriber: send email
```

## Dependency rule

`domain` → depends on nothing. `application` → depends on `domain` (+ ports).
`infrastructure` and `presentation` → depend inward. Mongoose/Express never leak
into domain or application.

## Commands

```bash
npm run typecheck     # strict tsc, no emit
npm test              # vitest (domain, use-cases, event flow, HTTP parity)
npm run openapi:gen   # Zod schemas -> openapi.json
npm run sdk:gen       # openapi.json -> src/sdk/generated/types.ts
npm run build:ts      # compile src -> dist (gitignored)
```

## The OrderPaid event flow (modular-monolith events)

`MarkOrderPaid` (orders) publishes `OrderPaid` on the in-memory `EventBus`.
Three independent subscribers react, each in its own module, none calling the
others:

- **inventory** → decrement stock (clamped at 0)
- **loyalty** → grant points
- **notifications** → send confirmation email

Wiring lives in `modules/orders/OrdersModule.ts`. See
`modules/orders/orderPaidFlow.test.ts` for the contract.

## Using the SDK from a TS app

```ts
import { createCroketeClient } from "./sdk/client";

const api = createCroketeClient({ baseUrl: "http://localhost:5055/v1", token });
const { products, totalDoc } = await api.catalog.list({ page: 1, limit: 20 });
const product = await api.catalog.getBySlug("royal-canin");
```

## Switching production onto the new catalog module (when ready)

The catalog router now has **full endpoint parity** with the legacy one
(including `GET /products/store`, `POST /products/all`,
`PATCH /products/update/many`). Parity is covered by
`modules/catalog/presentation/catalog.parity.test.ts`.

To flip traffic, build (`npm run build:ts`) and in `api/index.js` replace:

```js
const productRoutes = require("../routes/productRoutes");
```

with the router from `dist/modules/catalog/CatalogModule.js`:

```js
const { buildCatalogModule } = require("../dist/modules/catalog/CatalogModule");
const productRoutes = buildCatalogModule().router;
```

URLs are identical, so admin/store need no changes. Re-apply the same
`isAuth`/`isAdmin` guards on the mutation routes that the legacy app used. Roll
back by reverting that single require. Before flipping, run the parity suite
against a staging DB (mongodb-memory-server can be added for full DB-level
parity tests).
```
