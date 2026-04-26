# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development with hot-reload (nodemon)
npm start            # Production start
npm run data:import  # Seed database with initial data
npm run init:admin   # Bootstrap super admin user (one-time)
npm run generate-reviews  # Generate fake reviews for testing
```

Deploy to Google Cloud Run:
```bash
gcloud builds submit --config=cloudbuild.yaml --project=crokete
```

## Architecture Overview

**Crokete Pet** is a Node.js/Express REST API for a pet products e-commerce platform. Port 5055. Deployed on Google Cloud Run with MongoDB Atlas.

**Request flow:** `routes/` → `controller/` → `models/` (Mongoose) + `lib/` services

### Entry Point

[`api/index.js`](api/index.js) — registers ~30 route groups, applies middleware stack (trust proxy → Stripe webhook raw body → JSON parser → mongo-sanitize → Helmet → CORS → rate limiter), connects to MongoDB, warms cache on startup.

**Critical:** Stripe webhook routes must be registered BEFORE `express.json()` middleware to receive the raw body.

### Middleware Stack Order (important)

1. `trustProxy` for Cloud Run
2. Stripe webhook routes (raw body required)
3. `express.json` (4 MB limit)
4. `express-mongo-sanitize`
5. `helmet`
6. CORS (whitelists localhost + env `STORE_URL` + `ADMIN_URL`)
7. Global rate limiter (100 req/min)
8. Route-specific limiters (search, payment, contact)

### Authentication

[`config/auth.js`](config/auth.js) exports three middleware:
- `isAuth` — verifies JWT from `Authorization: Bearer` header
- `isAdmin` — requires admin role
- `isSuperAdmin` — verifies against DB for sensitive operations

Tokens: access (60 min default), refresh. AES-256-CBC used for encrypting sensitive stored data — requires a 32-character hex `ENCRYPT_PASSWORD`.

### Models (24 total)

Key models in [`models/`](models/):
- `Product` — multi-language title/description (stored as Object with locale keys), variants array, hierarchical pricing, refs to Category/Brand/Pet
- `Order` — full cart snapshot, payment method, status enum, customer info
- `Customer` / `Admin` — separate user tables; Admin has RBAC
- `LoyaltyConfig` / `LoyaltyReward` / `PointTransaction` — loyalty program
- `VetAppointment` / `Veterinarian` / `VetConfig` — vet consultation booking
- `Setting` / `Currency` / `Language` — runtime configuration synced from DB on startup

### Services (`lib/`)

| Directory | Purpose |
|---|---|
| `lib/email-sender/` | Nodemailer SMTP with rate-limited templates (Zoho) |
| `lib/cache/` | `node-cache` in-memory cache with warm-up & invalidation |
| `lib/security/` | Rate limiters, audit logging |
| `lib/stripe/` | Stripe checkout, webhooks, refunds |
| `lib/paypal/` | PayPal order creation/capture |
| `lib/phone-verification/` | Twilio SMS OTP |
| `lib/ai/` | AI product generation via Gemini / OpenAI |
| `lib/stock-controller/` | Inventory decrement/restore on order events |

### Config

[`config/index.js`](config/index.js) — centralized constants: company info, Cloudinary image URLs, email templates config.  
[`config/db.js`](config/db.js) — Mongoose connection with auto-retry.

### Data Seeding & Scripts

- [`utils/*.json`](utils/) — seed data (products, orders, categories, reviews)
- [`scripts/`](scripts/) — one-off migration and admin initialization scripts

## Environment Variables

Required variables (see `.env.example`):

```
MONGO_URI
JWT_SECRET, JWT_REFRESH_SECRET, JWT_SECRET_FOR_VERIFY
JWT_ACCESS_LIFETIME=60m
ENCRYPT_PASSWORD          # 32-char hex, AES-256-CBC
STRIPE_KEY, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET
PAYPAL_CLIENT_ID, PAYPAL_APP_SECRET
SERVICE=zoho, EMAIL_USER, EMAIL_PASS, HOST, EMAIL_PORT
CLOUDINARY_URL
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

**Multi-language fields:** title and description on Product/Category/Brand are plain JS Objects with locale keys (e.g., `{ es: "Pienso", en: "Dog Food" }`). No special Mongoose type — just `Object`.

**Caching:** Products and settings are cached in memory on startup. Controllers call invalidation helpers in `lib/cache/` after mutations.

**Payment gateways:** Stripe is primary; PayPal and Razorpay also integrated. Each has its own `lib/` subdirectory and dedicated webhook handling.

**Audit logging:** Significant admin mutations write to `AuditLog` model via helpers in `lib/security/`.

**GCP Secrets:** In production, env vars are pulled from GCP Secret Manager at startup via the sync utility in `api/index.js`.
