require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { getPrisma, disconnectPrisma } = require("../lib/prisma");
const { printConfigDiagnostics, syncEnvToDb } = require("../utils/getConfig");
const { globalLimiter, searchLimiter, paymentLimiter, uploadLimiter } = require("../lib/security/apiRateLimiter");
const { warmCache } = require("../lib/cache/warming");
const reviewRoutes = require("../routes/reviewRoutes");
const customerRoutes = require("../routes/customerRoutes");
const adminRoutes = require("../routes/adminRoutes");
const customerOrderRoutes = require("../routes/customerOrderRoutes");
const categoryRoutes = require("../routes/categoryRoutes");
const couponRoutes = require("../routes/couponRoutes");
const attributeRoutes = require("../routes/attributeRoutes");
const settingRoutes = require("../routes/settingRoutes");
const currencyRoutes = require("../routes/currencyRoutes");
const languageRoutes = require("../routes/languageRoutes");
const notificationRoutes = require("../routes/notificationRoutes");
const auditRoutes = require("../routes/auditRoutes");
const petRoutes = require("../routes/petRoutes");
const brandRoutes = require("../routes/brandRoutes");
const loyaltyRoutes = require("../routes/loyaltyRoutes");
const vetRoutes = require("../routes/vetRoutes");
const paymentLogRoutes = require("../routes/paymentLogRoutes");
const stripeWebhookRoutes = require("../routes/stripeWebhookRoutes");
const { getPublicConfig } = require("../controller/loyaltyController");
const { getPublicVetConfig } = require("../controller/vetConfigController");
const { getActiveVeterinarians } = require("../controller/veterinarianController");
const aiRoutes = require("../routes/aiRoutes");
const uploadRoutes = require("../routes/uploadRoutes");
const contactRoutes = require("../routes/contactRoutes");
const { isAuth, isAdmin } = require("../config/auth");

// ─── Catalog module: legacy JS or new TypeScript/DDD (feature-flagged) ───────
// USE_TS_CATALOG=true serves /v1/products from the compiled TS module
// (dist/modules/catalog), which has full endpoint parity with the legacy
// controller. The legacy app cache (utils/cache) is injected so invalidation
// stays consistent across modules. Roll back instantly by unsetting the flag.
//
// Ambos caminos ejecutan las mismas consultas (lib/prisma/catalog) y los mismos
// presentadores, así que la respuesta no depende del flag.
let productRoutes;
if (process.env.USE_TS_CATALOG === "true") {
  const sharedCache = require("../utils/cache");
  const { buildCatalogModule } = require("../dist/modules/catalog/CatalogModule");
  productRoutes = buildCatalogModule({
    cacheService: sharedCache,
    adminGuard: [isAuth, isAdmin], // protect product mutations
  }).router;
  console.log("🟢 Catalog: módulo TypeScript/DDD activo (USE_TS_CATALOG=true)");
} else {
  productRoutes = require("../routes/productRoutes");
}

// ─── Admin orders module: legacy JS or new TypeScript/DDD (feature-flagged) ──
// USE_TS_ORDERS=true serves /v1/orders (admin) from the compiled TS module.
// The customer/payment flow (/v1/order) ALWAYS stays on the legacy controller.
// Status side effects (loyalty + email) are injected from the shared JS module
// so behaviour is identical to the legacy admin updateOrder.
let orderRoutes;
if (process.env.USE_TS_ORDERS === "true") {
  const { orderStatusEffectsPort } = require("../lib/orders/statusChangeEffects");
  const { buildAdminOrdersModule } = require("../dist/modules/orders/AdminOrdersModule");
  orderRoutes = buildAdminOrdersModule({
    effects: orderStatusEffectsPort,
    guard: [isAdmin], // isAuth is applied at the mount below
  }).router;
  console.log("🟢 Orders (admin): módulo TypeScript/DDD activo (USE_TS_ORDERS=true)");
} else {
  orderRoutes = require("../routes/orderRoutes");
}

// ─── Customers module: ported routes (profile, shipping address, admin list) ──
// USE_TS_CUSTOMERS=true mounts a TS/DDD router BEFORE the legacy customer router
// on /v1/customer. It only defines the ported routes; every other route — ALL
// authentication flows (login, register, oauth, verify, password, refresh) and
// the legacy-broken address PUT/DELETE — falls through to the legacy router,
// untouched. Token signing and guards are injected from legacy config/auth.
let tsCustomerRouter = null;
if (process.env.USE_TS_CUSTOMERS === "true") {
  const {
    isSuperAdmin,
    generateAccessToken,
    generateRefreshToken,
  } = require("../config/auth");
  const { buildCustomersModule } = require("../dist/modules/customers/CustomersModule");
  tsCustomerRouter = buildCustomersModule({
    tokens: { generateAccessToken, generateRefreshToken },
    guards: { isAuth, isSuperAdmin },
  }).router;
  console.log("🟢 Customers: módulo TypeScript/DDD activo para perfil/direcciones (USE_TS_CUSTOMERS=true)");
}

const app = express();

// We are using this for the express-rate-limit middleware
// See: https://github.com/nfriedly/express-rate-limit
// app.enable('trust proxy');
app.set("trust proxy", 1);

// Stripe webhook — must come BEFORE express.json() middleware would parse the body
// but since we use express.raw() on the route itself, register it before general routes
app.use("/v1/webhook", stripeWebhookRoutes);

// AI routes accept base64 images for vision/OCR → larger body limit (parsed here
// first; the global 4mb parser below then skips since the body is already read).
app.use("/v1/ai", express.json({ limit: "15mb" }));
// Image uploads also receive base64 images → larger body limit.
app.use("/v1/upload", express.json({ limit: "15mb" }));

app.use(express.json({ limit: "4mb" }));
// express-mongo-sanitize se retiró con la migración: limpiaba operadores `$` y
// puntos de las claves del body para evitar inyección en consultas de Mongo.
// Prisma envía parámetros tipados, así que ya no hay nada que sanear ahí.
app.use(helmet());

const isDev = process.env.NODE_ENV !== "production";
const corsOptions = {
  origin: [
    ...(isDev
      ? [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:4100",
          "http://localhost:4101",
          "http://192.168.0.14:3000",
        ]
      : []),
    process.env.ADMIN_URL,
    process.env.STORE_URL,
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(globalLimiter);

// Health check — para Cloud Run y load balancers
// Prisma abre la conexión de forma perezosa, así que no hay un "readyState" que
// consultar: se comprueba con una consulta trivial contra Postgres.
app.get("/health", async (req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.get("/", (req, res) => {
  res.send("App works properly!");
});

//this for route will need for store front, also for admin dashboard
app.use("/v1/products/", searchLimiter, productRoutes);
app.use("/v1/reviews/", isAuth, reviewRoutes);
app.use("/v1/category/", categoryRoutes);
app.use("/v1/coupon/", couponRoutes);
// TS customer router (if enabled) handles ported routes; rest falls through to legacy
if (tsCustomerRouter) app.use("/v1/customer/", tsCustomerRouter);
app.use("/v1/customer/", customerRoutes);
app.use("/v1/order/", isAuth, paymentLimiter, customerOrderRoutes);
app.use("/v1/attributes/", attributeRoutes);
app.use("/v1/setting/", settingRoutes);
app.use("/v1/currency/", isAuth, currencyRoutes);
app.use("/v1/language/", languageRoutes);
app.use("/v1/notification/", isAuth, notificationRoutes);
app.use("/v1/pets/", petRoutes);
app.use("/v1/brands/", brandRoutes);
app.get("/v1/loyalty/public-config", getPublicConfig);
app.use("/v1/loyalty/", isAuth, loyaltyRoutes);

// Vet consultation routes
app.get("/v1/vet/public-config", getPublicVetConfig);
app.get("/v1/vet/veterinarians/public", getActiveVeterinarians);
app.use("/v1/vet/", isAuth, vetRoutes);

//if you not use admin dashboard then these two route will not needed.
app.use("/v1/admin/", adminRoutes);
app.use("/v1/orders/", isAuth, orderRoutes);
app.use("/v1/audit/", auditRoutes);
app.use("/v1/payment-logs/", isAuth, isAdmin, paymentLogRoutes);

// AI product generation routes (admin only)
app.use("/v1/ai/", isAuth, aiRoutes);

// Centralized image uploads (admin only) — normalizes to webp + uniform size
app.use("/v1/upload/", isAuth, uploadLimiter, uploadRoutes);

// Contact form (public)
app.use("/v1/contact", contactRoutes);

// Error handler — no expone detalles internos en producción
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  const message = isDev
    ? err.message
    : "Ocurrió un error. Por favor intenta de nuevo.";
  res.status(status).json({ message });
});

// Serve static files from the "dist" directory
app.use("/static", express.static("public"));

// Serve the index.html file for all routes
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "build", "index.html"));
// });

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`server running on port ${PORT}`);
  console.log("\n📋 Configuration Diagnostics:");
  try {
    await syncEnvToDb();
    await printConfigDiagnostics();
  } catch (err) {
    console.error("  ⚠️  Could not run config diagnostics:", err.message);
  }
  try {
    await warmCache();
  } catch (err) {
    console.error("  ⚠️  Cache warming falló:", err.message);
  }
  console.log("");
});

// Graceful shutdown para Cloud Run (SIGTERM) y Ctrl+C (SIGINT)
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(async () => {
    try {
      await disconnectPrisma();
      console.log("Postgres desconectado. Proceso terminado.");
    } catch (err) {
      console.error("Error al cerrar Postgres:", err.message);
    }
    process.exit(0);
  });

  // Forzar cierre si tarda más de 10s
  setTimeout(() => {
    console.error("Shutdown forzado por timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
