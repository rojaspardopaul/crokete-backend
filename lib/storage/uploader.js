/**
 * Centralized image upload — Supabase Storage.
 *
 * Single place that normalizes every product/admin image: any input format
 * (jpg/png/jpeg/…) is stored as WEBP at a uniform size, so the product carousel
 * looks even.
 *
 * Replaces the previous Cloudinary uploader. Cloudinary applied the resize on
 * ingest via its own transformation pipeline; Supabase Storage does no image
 * processing on upload, so the normalization happens here with sharp before the
 * bytes are sent. The exported signature is unchanged so callers
 * (controller/uploadController.js and the ETL) did not need edits.
 */
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const SQUARE_SIZE = 1000;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "crokete";

let cachedClient = null;

/**
 * Service-role client — bypasses RLS, so it must never be exposed to the
 * browser. Created lazily so requiring this module doesn't throw at boot when
 * storage isn't configured (e.g. during the Mongo→Postgres transition).
 */
function getClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage no configurado: falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Accepts a data-URI or a remote URL and returns the raw bytes + mime type. */
async function readSource(fileDataUri) {
  const dataUriMatch = /^data:([^;,]+)(;base64)?,(.*)$/is.exec(fileDataUri);

  if (dataUriMatch) {
    const [, mimeType, isBase64, payload] = dataUriMatch;
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { buffer, mimeType };
  }

  // Remote URL — used when migrating images that already live elsewhere.
  const response = await fetch(fileDataUri);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status}): ${fileDataUri}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  return { buffer, mimeType };
}

/**
 * Mirrors the two Cloudinary transformations this project relied on:
 *   square=true  → c_pad 1000×1000 on white (products; keeps the grid even)
 *   square=false → c_limit 1000 wide, aspect preserved (logos/avatars)
 * `limit` never upscales, which is why only the padded variant enlarges.
 */
async function normalizeToWebp(buffer, square) {
  const pipeline = sharp(buffer, { failOn: "none" }).rotate();

  if (square) {
    pipeline.resize(SQUARE_SIZE, SQUARE_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  } else {
    pipeline.resize(SQUARE_SIZE, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  return pipeline.webp({ quality: 82 }).toBuffer();
}

function buildObjectPath(folder, extension) {
  const cleanFolder = String(folder || "crokete")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanFolder}/${unique}.${extension}`;
}

/**
 * Upload an image (data-URI or remote URL) to Supabase Storage, normalized.
 *
 * @param {string} fileDataUri - "data:image/png;base64,…" (or a URL).
 * @param {object} [opts]
 * @param {string} [opts.folder="crokete"] - Destination folder in the bucket.
 * @param {boolean} [opts.square=true] - true: pad to SQUARE_SIZE² with white bg
 *        (products, uniform carousel). false: convert to webp limited to
 *        SQUARE_SIZE keeping aspect ratio (logos/avatars).
 * @param {boolean} [opts.isSvg=false] - upload vector as-is (no raster transform).
 * @returns {Promise<string>} public URL of the stored asset.
 */
async function uploadImage(fileDataUri, opts = {}) {
  const { folder = "crokete", square = true, isSvg = false } = opts;

  const { buffer, mimeType } = await readSource(fileDataUri);

  // SVG stays vectorial: rasterizing it would defeat the point.
  const treatAsSvg = isSvg || /svg\+xml/i.test(mimeType);

  const body = treatAsSvg ? buffer : await normalizeToWebp(buffer, square);
  const contentType = treatAsSvg ? "image/svg+xml" : "image/webp";
  const objectPath = buildObjectPath(folder, treatAsSvg ? "svg" : "webp");

  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(objectPath, body, { contentType, upsert: false });

  if (error) {
    throw new Error(`Supabase Storage: ${error.message}`);
  }

  const { data } = getClient().storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

module.exports = { uploadImage, SQUARE_SIZE, BUCKET };
