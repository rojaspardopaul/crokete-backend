/**
 * Centralized credential resolution.
 *
 * Priority: process.env  →  DB storeSetting  →  null/error
 *
 * Every controller that needs Stripe, email, or OAuth credentials
 * should call these helpers instead of reading env/DB directly.
 */
require("dotenv").config();
const { readSetting, mergeSetting } = require("../lib/prisma/settings");

// Cache DB setting for 60s to avoid repeated queries within the same process
let _cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000;

const getStoreSetting = async () => {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < CACHE_TTL) return _cache.data;
  _cache = { data: (await readSetting("storeSetting")) || {}, ts: now };
  return _cache.data;
};

/** Invalidate the cache (call after admin updates settings) */
const invalidateConfigCache = () => {
  _cache = { data: null, ts: 0 };
};

// --------------- Stripe ---------------

const getStripeConfig = async () => {
  const db = await getStoreSetting();
  return {
    secretKey: process.env.STRIPE_SECRET || db.stripe_secret || null,
    publicKey: process.env.STRIPE_KEY || db.stripe_key || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    source: process.env.STRIPE_SECRET ? ".env" : db.stripe_secret ? "database" : "none",
  };
};

// --------------- Email ---------------

const getEmailConfig = async () => {
  return {
    host: process.env.EMAIL_HOST || process.env.HOST || null,
    port: Number(process.env.EMAIL_PORT) || 465,
    user: process.env.EMAIL_USER || null,
    pass: process.env.EMAIL_PASS || null,
    service: process.env.SERVICE || null,
    source: process.env.EMAIL_USER ? ".env" : "none",
  };
};

// --------------- OAuth ---------------

const getOAuthConfig = async (provider) => {
  const db = await getStoreSetting();
  const map = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || db.google_id || null,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || db.google_secret || null,
    },
    github: {
      clientId: db.github_id || null,
      clientSecret: db.github_secret || null,
    },
    facebook: {
      clientId: db.facebook_id || null,
      clientSecret: db.facebook_secret || null,
    },
  };
  return map[provider] || { clientId: null, clientSecret: null };
};

// --------------- Startup Diagnostics ---------------

/**
 * Extracts the Stripe account ID segment from a key.
 * e.g. "pk_test_51SIzdtPEd..." → "51SIzdt"
 */
const extractAccountPrefix = (key) => {
  if (!key) return null;
  const match = key.match(/^[psk]{2}_(?:test|live)_(\w{7})/);
  return match ? match[1] : null;
};

const getStripeMode = (key) => {
  if (!key) return null;
  if (key.startsWith("pk_test_") || key.startsWith("sk_test_")) return "test";
  if (key.startsWith("pk_live_") || key.startsWith("sk_live_")) return "live";
  return "unknown";
};

/**
 * Prints a startup diagnostic summary and returns warnings.
 * Call once after DB connection is established.
 */
const printConfigDiagnostics = async () => {
  const warnings = [];
  const db = await getStoreSetting();

  // --- Stripe ---
  const envSK = process.env.STRIPE_SECRET;
  const envPK = process.env.STRIPE_KEY;
  const dbSK = db.stripe_secret;
  const dbPK = db.stripe_key;

  const activeSK = envSK || dbSK;
  const activePK = envPK || dbPK;
  const stripeSource = envSK ? ".env" : dbSK ? "database" : "none";

  if (!activeSK || !activePK) {
    console.log("  ❌ Stripe: NOT CONFIGURED");
    warnings.push("Stripe secret/public key not configured");
  } else {
    const mode = getStripeMode(activeSK);
    const pkPrefix = extractAccountPrefix(activePK);
    const skPrefix = extractAccountPrefix(activeSK);

    if (pkPrefix && skPrefix && pkPrefix !== skPrefix) {
      console.log(`  ⚠️  Stripe: ACCOUNT MISMATCH — pk(${pkPrefix}) ≠ sk(${skPrefix})`);
      warnings.push(`Stripe public key account (${pkPrefix}) differs from secret key account (${skPrefix})`);
    } else {
      console.log(`  ✅ Stripe: ${mode} mode (${skPrefix || "?"}) — source: ${stripeSource}`);
    }

    // Check DB vs ENV mismatch
    if (envSK && dbSK && extractAccountPrefix(envSK) !== extractAccountPrefix(dbSK)) {
      console.log(`  ⚠️  Stripe: DB has different account than .env (DB: ${extractAccountPrefix(dbSK)}, ENV: ${extractAccountPrefix(envSK)})`);
      warnings.push("DB stripe_secret belongs to a different Stripe account than .env STRIPE_SECRET");
    }
  }

  // --- Email ---
  const emailUser = process.env.EMAIL_USER;
  const emailService = process.env.SERVICE;
  if (emailUser) {
    console.log(`  ✅ Email: ${emailService || "smtp"} (${emailUser}) — source: .env`);
  } else {
    console.log("  ⚠️  Email: not configured");
  }

  // --- OAuth ---
  const googleId = process.env.GOOGLE_CLIENT_ID || db.google_id;
  if (googleId) {
    const src = process.env.GOOGLE_CLIENT_ID ? ".env" : "database";
    console.log(`  ✅ Google OAuth: configured — source: ${src}`);
  } else {
    console.log("  ⚠️  Google OAuth: not configured");
  }

  // --- Almacenamiento de imágenes (Supabase Storage) ---
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "crokete";
    console.log(`  ✅ Supabase Storage: configurado (bucket: ${bucket})`);
  } else {
    console.log("  ⚠️  Supabase Storage: sin configurar — no se podrán subir imágenes");
  }

  // --- Webhook ---
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("  ✅ Stripe Webhook: configured — source: .env");
  } else {
    console.log("  ⚠️  Stripe Webhook: not configured");
  }

  return warnings;
};

// --------------- ENV → DB Sync ---------------

/**
 * Syncs env vars to DB storeSetting if the DB field is empty.
 * Does NOT overwrite values set via the admin panel.
 */
const syncEnvToDb = async () => {
  const db = await getStoreSetting();
  const fieldsToSync = {
    stripe_key: process.env.STRIPE_KEY,
    stripe_secret: process.env.STRIPE_SECRET,
    google_id: process.env.GOOGLE_CLIENT_ID,
    google_secret: process.env.GOOGLE_CLIENT_SECRET,
    nextauth_secret: process.env.NEXTAUTH_SECRET,
  };

  const updates = {};
  const synced = [];

  for (const [dbField, envValue] of Object.entries(fieldsToSync)) {
    if (envValue && !db[dbField]) {
      updates[dbField] = envValue;
      synced.push(dbField);
    }
  }

  if (Object.keys(updates).length > 0) {
    await mergeSetting("storeSetting", updates);
    invalidateConfigCache();
    console.log(`  🔄 Synced ENV → DB: ${synced.join(", ")}`);
  }
};

// --------------- Config Status (for admin endpoint) ---------------

const getConfigStatus = async () => {
  const db = await getStoreSetting();
  const envSK = process.env.STRIPE_SECRET;
  const envPK = process.env.STRIPE_KEY;
  const dbSK = db.stripe_secret;
  const dbPK = db.stripe_key;
  const activeSK = envSK || dbSK;
  const activePK = envPK || dbPK;

  const maskKey = (key) => {
    if (!key) return null;
    return key.length > 15 ? key.substring(0, 15) + "****" : "****";
  };

  return {
    stripe: {
      source: envSK ? ".env" : dbSK ? "database" : "none",
      mode: getStripeMode(activeSK),
      accountPrefix: extractAccountPrefix(activeSK),
      publicKey: maskKey(activePK),
      secretConfigured: !!activeSK,
      dbMatchesEnv: !envSK || !dbSK || extractAccountPrefix(envSK) === extractAccountPrefix(dbSK),
    },
    email: {
      source: process.env.EMAIL_USER ? ".env" : "none",
      configured: !!process.env.EMAIL_USER,
      service: process.env.SERVICE || null,
      user: process.env.EMAIL_USER || null,
    },
    storage: {
      source: process.env.SUPABASE_URL ? ".env" : "none",
      configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      bucket: process.env.SUPABASE_STORAGE_BUCKET || "crokete",
    },
    google_oauth: {
      source: process.env.GOOGLE_CLIENT_ID ? ".env" : db.google_id ? "database" : "none",
      configured: !!(process.env.GOOGLE_CLIENT_ID || db.google_id),
    },
    webhook: {
      source: process.env.STRIPE_WEBHOOK_SECRET ? ".env" : "none",
      configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
  };
};

module.exports = {
  getStripeConfig,
  getEmailConfig,
  getOAuthConfig,
  getConfigStatus,
  printConfigDiagnostics,
  syncEnvToDb,
  invalidateConfigCache,
};
