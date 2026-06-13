require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
// const path = require("path");
// const http = require("http");
// const { Server } = require("socket.io");

const { connectDB } = require("../config/db");
const { printConfigDiagnostics, syncEnvToDb } = require("../utils/getConfig");
const { globalLimiter, searchLimiter, paymentLimiter } = require("../lib/security/apiRateLimiter");
const { warmCache } = require("../lib/cache/warming");
const reviewRoutes = require("../routes/reviewRoutes");
const customerRoutes = require("../routes/customerRoutes");
const adminRoutes = require("../routes/adminRoutes");
const orderRoutes = require("../routes/orderRoutes");
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
const contactRoutes = require("../routes/contactRoutes");
const { isAuth, isAdmin } = require("../config/auth");
// const {
//   getGlobalSetting,
//   getStoreCustomizationSetting,
// } = require("../lib/notification/setting");

const mongoose = require("mongoose");

// ─── Catalog module: legacy JS or new TypeScript/DDD (feature-flagged) ───────
// USE_TS_CATALOG=true serves /v1/products from the compiled TS module
// (dist/modules/catalog), which has full endpoint parity with the legacy
// controller. The legacy app cache (utils/cache) is injected so invalidation
// stays consistent across modules. Roll back instantly by unsetting the flag.
//
// Built HERE (after the route requires above) on purpose: those requires have
// already registered the legacy Mongoose models, so the TS module reuses the
// full legacy schemas instead of racing to register its own.
let productRoutes;
if (process.env.USE_TS_CATALOG === "true") {
  const sharedCache = require("../utils/cache");
  const { buildCatalogModule } = require("../dist/modules/catalog/CatalogModule");
  productRoutes = buildCatalogModule({ cacheService: sharedCache }).router;
  console.log("🟢 Catalog: módulo TypeScript/DDD activo (USE_TS_CATALOG=true)");
} else {
  productRoutes = require("../routes/productRoutes");
}

connectDB();
const app = express();

// We are using this for the express-rate-limit middleware
// See: https://github.com/nfriedly/express-rate-limit
// app.enable('trust proxy');
app.set("trust proxy", 1);

// Stripe webhook — must come BEFORE express.json() middleware would parse the body
// but since we use express.raw() on the route itself, register it before general routes
app.use("/v1/webhook", stripeWebhookRoutes);

app.use(express.json({ limit: "4mb" }));
app.use(mongoSanitize());
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
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(503).json({ status: "error", db: "disconnected" });
  }
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("App works properly!");
});

//this for route will need for store front, also for admin dashboard
app.use("/v1/products/", searchLimiter, productRoutes);
app.use("/v1/reviews/", isAuth, reviewRoutes);
app.use("/v1/category/", categoryRoutes);
app.use("/v1/coupon/", couponRoutes);
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
      await mongoose.connection.close();
      console.log("MongoDB desconectado. Proceso terminado.");
    } catch (err) {
      console.error("Error al cerrar MongoDB:", err.message);
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

// set up socket
// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:3000",
//       "http://localhost:4100",
//       "https://admin-kachabazar.vercel.app",
//       "https://dashtar-admin.vercel.app",
//       "https://kachabazar-store.vercel.app",
//       "https://kachabazar-admin.netlify.app",
//       "https://dashtar-admin.netlify.app",
//       "https://kachabazar-store-nine.vercel.app",
//     ], //add your origin here instead of this
//     methods: ["PUT", "GET", "POST", "DELETE", "PATCH", "OPTIONS"],
//     credentials: false,
//     transports: ["websocket"],
//   },
// });

// io.on("connection", (socket) => {
//   // console.log(`Socket ${socket.id} connected!`);

//   socket.on("notification", async (data) => {
//     console.log("data", data);
//     try {
//       let updatedData = data;

//       if (data?.option === "storeCustomizationSetting") {
//         const storeCustomizationSetting = await getStoreCustomizationSetting(
//           data
//         );
//         updatedData = {
//           ...data,
//           storeCustomizationSetting: storeCustomizationSetting,
//         };
//       }
//       if (data?.option === "globalSetting") {
//         const globalSetting = await getGlobalSetting(data);
//         updatedData = {
//           ...data,
//           globalSetting: globalSetting,
//         };
//       }
//       io.emit("notification", updatedData);
//     } catch (error) {
//       console.error("Error handling notification:", error);
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`Socket ${socket.id} disconnected!`);
//   });
// });
// server.listen(PORT, () => console.log(`server running on port ${PORT}`));
