# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build:ts     # Compile src/ → dist/ AND generate the Prisma client
npm run dev          # Development with hot-reload (nodemon) — needs a build first
npm start            # Production start
npm run init:admin   # Bootstrap super admin user (one-time)
npm run typecheck    # tsc --noEmit
npm test             # vitest
npx prisma migrate deploy   # Apply pending migrations
npx prisma studio           # Browse the database
```

No queda nada de MongoDB en el repositorio: modelos Mongoose, scripts de siembra
de la plantilla y el ETL de migración se eliminaron una vez completado el corte.

## Despliegue

**Railway**, desde el `Dockerfile` del repo, en `backend.crokete.com.mx`. El
despliegue se dispara con `git push`; las variables de entorno se configuran en
el panel de Railway (no hay gestor de secretos en el repositorio) y el
healthcheck apunta a `GET /health`.

Los frontends (`crokete-admin`, `crokete-store`) están en Vercel y la base de
datos y las imágenes en Supabase (proyecto `mcvufmicaqrhgwdharub`, bucket
`crokete`). GCP se dio de baja: no queda nada de Cloud Run ni Secret Manager.

En producción los módulos TypeScript/DDD se sirven con `USE_TS_CATALOG`,
`USE_TS_ORDERS` y `USE_TS_CUSTOMERS` en `true`.

## Architecture Overview

**Crokete Pet** is a Node.js/Express REST API for a pet products e-commerce platform. Port 5055 en local. Desplegado en **Railway** con **PostgreSQL (Supabase)** vía Prisma.

**Request flow:** `routes/` → `controller/` → `lib/prisma/` (Prisma Client) + `lib/` services

Las rutas de catálogo, pedidos (admin) y clientes pueden servirse desde los
módulos TypeScript/DDD de [`src/modules/`](src/modules/) con los flags
`USE_TS_*`. Ambos caminos ejecutan las mismas consultas
([`lib/prisma/catalog.js`](lib/prisma/catalog.js)) y los mismos presentadores,
así que la respuesta no depende del flag.

### Entry Point

[`api/index.js`](api/index.js) — registers ~30 route groups, applies middleware stack (trust proxy → Stripe webhook raw body → JSON parser → Helmet → CORS → rate limiter), warms cache on startup. La conexión a Postgres es perezosa (Prisma abre el pool en la primera consulta); `/health` la comprueba con un `SELECT 1`.

**Critical:** Stripe webhook routes must be registered BEFORE `express.json()` middleware to receive the raw body.

### Middleware Stack Order (important)

1. `trustProxy` (el proxy de Railway)
2. Stripe webhook routes (raw body required)
3. `express.json` (4 MB limit)
4. `helmet`
5. CORS (whitelists localhost + env `STORE_URL` + `ADMIN_URL`)
6. Global rate limiter (100 req/min)
7. Route-specific limiters (search, payment, contact)

### Authentication

[`config/auth.js`](config/auth.js) exports three middleware:
- `isAuth` — verifies JWT from `Authorization: Bearer` header
- `isAdmin` — requires admin role
- `isSuperAdmin` — verifies against DB for sensitive operations

Tokens: access (60 min default), refresh. AES-256-CBC used for encrypting sensitive stored data — requires a 32-character hex `ENCRYPT_PASSWORD`.

### Esquema (28 tablas)

El esquema vive en [`prisma/schema.prisma`](prisma/schema.prisma):
- `Product` + `ProductVariant` + `ProductCategory` — los arrays embebidos de Mongo son tablas con FK. Textos multi-idioma y contenido de ficha en `jsonb`; lo que se filtra o agrega, en columnas tipadas.
- `Order` + `OrderItem` — cada línea es una fila; `snapshot` conserva el ítem del carrito tal como se compró. `invoice` es una secuencia nativa.
- `Customer` / `Admin` — tablas separadas; los agregados de lealtad son columnas del cliente.
- `LoyaltyConfig` / `LoyaltyReward` / `PointTransaction` — loyalty program
- `VetAppointment` / `Veterinarian` / `VetConfig` / `CustomerPet` — vet consultation booking
- `Setting` / `Currency` / `Language` — runtime configuration

El esquema Prisma es la única fuente de verdad del modelo de datos.

### Capa de datos (`lib/prisma/`)

| Archivo | Propósito |
|---|---|
| `index.js` | Singleton de PrismaClient (un pool por proceso) y `getPrismaNamespace()` |
| `presenters.js` | Fila → forma heredada de la API (`_id`, `prices` anidado, Decimal → number). **Toda** la compatibilidad con los frontends vive aquí |
| `helpers.js` | `isUuid`, `uuidList`, respuestas de error homogéneas |
| `catalog.js` | Consultas y escrituras del catálogo, compartidas con el módulo DDD |
| `settings.js` | Lectura y merge atómico de la configuración (`jsonb ||`) |

### Services (`lib/`)

| Directory | Purpose |
|---|---|
| `lib/email-sender/` | Nodemailer SMTP with rate-limited templates (Zoho) |
| `lib/cache/` | `node-cache` in-memory cache with warm-up & invalidation |
| `lib/security/` | Rate limiters, audit logging |
| `lib/stripe/` | Stripe checkout, webhooks, refunds |
| `lib/storage/` | Subida de imágenes a Supabase Storage (webp 1000×1000 con sharp) |
| `lib/phone-verification/` | Twilio SMS OTP |
| `lib/ai/` | AI product generation via Gemini / OpenAI |
| `lib/stock-controller/` | Inventory decrement/restore on order events |

### Config

[`config/index.js`](config/index.js) — constantes centralizadas: datos de la empresa, `ASSETS.LOGO` (logo de los correos, servido desde Supabase Storage) y configuración de las plantillas de correo.

### Data Seeding & Scripts

- [`scripts/init-super-admin.js`](scripts/init-super-admin.js) — bootstrap del super admin (Prisma)
- Los datos de catálogo y configuración se migraron una sola vez con un ETL que
  ya se retiró; el historial de pruebas (pedidos, clientes, notificaciones) se
  descartó a propósito.

## Environment Variables

Required variables (see `.env.example`):

```
DATABASE_URL              # PostgreSQL (Supabase)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET  # imágenes
JWT_SECRET, JWT_REFRESH_SECRET, JWT_SECRET_FOR_VERIFY
JWT_ACCESS_LIFETIME=60m
ENCRYPT_PASSWORD          # 32-char hex, AES-256-CBC
STRIPE_KEY, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET
SERVICE=zoho, EMAIL_USER, EMAIL_PASS, HOST, EMAIL_PORT
STORE_URL, ADMIN_URL      # CORS origins
```

Optional:
```
GEMINI_API_KEY, OPENAI_API_KEY   # AI product generation
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  # OAuth
TWILIO_*                          # Phone verification
```

Bootstrap only (one-time `init:admin`):
```
SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
```

## Key Patterns

**Multi-language fields:** title and description on Product/Category/Brand son objetos con clave de idioma (`{ es: "Pienso", en: "Dog Food" }`), guardados en columnas `jsonb`. Las búsquedas por texto comparan el jsonb completo con `ILIKE`, así que cubren todos los idiomas de una vez.

**Compatibilidad de la API:** el esquema está normalizado (`id` uuid, Decimal, columnas planas) pero la API sigue devolviendo `_id`, `prices` anidado y números. Esa traducción vive **sólo** en `lib/prisma/presenters.js`; ningún controlador debe devolver filas crudas.

**Identificadores:** los ids son uuid. Todo endpoint que reciba uno valida con `isUuid` antes de consultar — Postgres responde con error de tipo (500) ante un uuid mal formado, donde Mongo simplemente no encontraba nada.

**Caching:** Products and settings are cached in memory on startup. Controllers call invalidation helpers in `lib/cache/` after mutations.

**Pagos:** Stripe (tarjeta) y efectivo contra entrega. Razorpay y PayPal, que venían de la plantilla original, se retiraron por completo.

**Audit logging:** Significant admin mutations write to the `AuditLog` table via helpers in `lib/security/`.

**Roles:** los enums de Postgres no admiten espacios, así que el rol se guarda como `super_admin` y los presentadores lo traducen a `"super admin"`, que es lo que el panel envía y espera.

**Configuración en caliente:** al arrancar, `syncEnvToDb` copia a la tabla `Setting` las claves que estén vacías en la base (Stripe, OAuth), de modo que el panel pueda editarlas sin redeploy. Las variables de entorno siempre ganan sobre la base.
