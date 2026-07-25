const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { fail, notFound } = require("../lib/prisma/helpers");
const { getConfigStatus, invalidateConfigCache } = require("../utils/getConfig");

const settings = () => getPrisma().setting;

/** Devuelve el objeto `setting` de una configuración con nombre dado. */
async function readSetting(name) {
  const row = await settings().findUnique({ where: { name } });
  return row ? row.setting : null;
}

/**
 * Fusiona claves de primer nivel dentro del jsonb, creando la fila si no
 * existe. El operador `||` de jsonb hace exactamente el mismo merge superficial
 * que `$set: { "setting.<clave>": valor }` en Mongo, pero en una sola sentencia
 * atómica: no hay lectura-modificación-escritura que se pueda perder si dos
 * pestañas del panel guardan a la vez.
 */
async function mergeSetting(name, patch) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw`
    INSERT INTO settings (id, name, setting, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${name}, ${JSON.stringify(patch || {})}::jsonb, now(), now())
    ON CONFLICT (name) DO UPDATE
      SET setting = settings.setting || EXCLUDED.setting,
          "updatedAt" = now()
    RETURNING *`;
  return toApi(rows[0]);
}

// ─── Configuración global ────────────────────────────────────────────────────

const addGlobalSetting = async (req, res) => {
  try {
    await settings().create({
      data: { name: req.body.name || "globalSetting", setting: req.body.setting || {} },
    });
    res.send({ message: "¡Configuración global agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getGlobalSetting = async (req, res) => {
  try {
    const setting = await readSetting("globalSetting");
    if (!setting) return notFound(res, "¡Configuración global no encontrada!");
    res.send(setting);
  } catch (err) {
    fail(res, err);
  }
};

const updateGlobalSetting = async (req, res) => {
  try {
    const data = await mergeSetting("globalSetting", req.body.setting);
    res.send({ data, message: "¡Configuración global actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

// ─── Configuración de la tienda ──────────────────────────────────────────────

const addStoreSetting = async (req, res) => {
  try {
    await settings().create({
      data: { name: req.body.name || "storeSetting", setting: req.body.setting || {} },
    });
    res.send({ message: "¡Configuración de la tienda agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getStoreSetting = async (req, res) => {
  try {
    const setting = await readSetting("storeSetting");
    if (!setting) return notFound(res, "¡Configuración de la tienda no encontrada!");
    if (req.query.filter === "all") return res.send(setting);

    const {
      cod_status, fb_pixel_key, fb_pixel_status,
      google_analytic_key, google_analytic_status,
      google_login_status, google_id,
      facebook_login_status, facebook_id,
      github_login_status, github_id,
      meta_url, razorpay_id, razorpay_status,
      stripe_key, stripe_status,
      tawk_chat_property_id, tawk_chat_status, tawk_chat_widget_id,
    } = setting;

    // El endpoint público nunca expone ids/secretos de OAuth: sólo banderas
    // derivadas que le dicen al front si el proveedor está realmente listo.
    res.send({
      cod_status,
      fb_pixel_key,
      fb_pixel_status,
      google_analytic_key,
      google_analytic_status,
      google_login_status,
      google_oauth_ready: !!(google_login_status && google_id),
      meta_url,
      razorpay_id,
      razorpay_status,
      stripe_key,
      stripe_status,
      tawk_chat_property_id,
      tawk_chat_status,
      tawk_chat_widget_id,
      facebook_login_status,
      facebook_oauth_ready: !!(facebook_login_status && facebook_id),
      github_login_status,
      github_oauth_ready: !!(github_login_status && github_id),
    });
  } catch (err) {
    fail(res, err);
  }
};

const getStoreSecretKeys = async (req, res) => {
  try {
    const setting = await readSetting("storeSetting");
    if (!setting) return notFound(res, "¡Configuración de la tienda no encontrada!");

    const {
      google_id, google_secret, google_login_status,
      facebook_id, facebook_secret, facebook_login_status,
      github_id, github_secret, github_login_status,
      razorpay_id, razorpay_secret, stripe_secret, nextauth_secret,
    } = setting;

    res.send({
      google_id, google_secret, google_login_status,
      facebook_id, facebook_secret, facebook_login_status,
      github_id, github_secret, github_login_status,
      razorpay_id, razorpay_secret, stripe_secret, nextauth_secret,
    });
  } catch (err) {
    fail(res, err);
  }
};

const updateStoreSetting = async (req, res) => {
  try {
    const data = await mergeSetting("storeSetting", req.body.setting);
    invalidateConfigCache();
    res.send({ data, message: "¡Configuración de la tienda actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

// ─── Personalización de la tienda ────────────────────────────────────────────

const addStoreCustomizationSetting = async (req, res) => {
  try {
    const row = await settings().create({
      data: {
        name: req.body.name || "storeCustomizationSetting",
        setting: req.body.setting || {},
      },
    });
    res.send({
      data: toApi(row),
      message: "¡Personalización de la tienda agregada correctamente!",
    });
  } catch (err) {
    fail(res, err);
  }
};

const getStoreCustomizationSetting = async (req, res) => {
  try {
    const setting = await readSetting("storeCustomizationSetting");
    if (!setting) return notFound(res, "Configuración no encontrada");
    res.send(setting);
  } catch (err) {
    fail(res, err);
  }
};

const getStoreSeoSetting = async (req, res) => {
  try {
    res.send(await readSetting("storeCustomizationSetting"));
  } catch (err) {
    fail(res, err);
  }
};

const updateStoreCustomizationSetting = async (req, res) => {
  try {
    const data = await mergeSetting("storeCustomizationSetting", req.body.setting);
    res.send({ data, message: "¡Personalización de la tienda actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getConfigStatusEndpoint = async (req, res) => {
  try {
    res.send(await getConfigStatus());
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addGlobalSetting,
  getGlobalSetting,
  updateGlobalSetting,
  addStoreSetting,
  getStoreSetting,
  getStoreSecretKeys,
  updateStoreSetting,
  getStoreSeoSetting,
  addStoreCustomizationSetting,
  getStoreCustomizationSetting,
  updateStoreCustomizationSetting,
  getConfigStatusEndpoint,
};
