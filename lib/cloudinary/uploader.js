/**
 * Centralized Cloudinary image upload.
 *
 * Single place that normalizes every product/admin image: any input format
 * (jpg/png/jpeg/…) is stored as WEBP at a uniform size, so the product carousel
 * looks even. The heavy lifting is delegated to Cloudinary's incoming
 * transformation (no sharp/multer needed). The SDK auto-reads CLOUDINARY_URL.
 */
const cloudinary = require("cloudinary").v2;

cloudinary.config({ secure: true });

const SQUARE_SIZE = 1000;

/**
 * Upload an image (data-URI or remote URL) to Cloudinary, normalized.
 *
 * @param {string} fileDataUri - "data:image/png;base64,…" (or a URL).
 * @param {object} [opts]
 * @param {string} [opts.folder="crokete"] - Cloudinary folder.
 * @param {boolean} [opts.square=true] - true: pad to SQUARE_SIZE² with white bg
 *        (products, uniform carousel). false: convert to webp limited to
 *        SQUARE_SIZE keeping aspect ratio (logos/avatars).
 * @param {boolean} [opts.isSvg=false] - upload vector as-is (no raster transform).
 * @returns {Promise<string>} secure_url of the stored asset.
 */
async function uploadImage(fileDataUri, opts = {}) {
  const { folder = "crokete", square = true, isSvg = false } = opts;

  const uploadOptions = { folder, resource_type: "image" };

  if (!isSvg) {
    uploadOptions.format = "webp";
    uploadOptions.transformation = square
      ? [{ width: SQUARE_SIZE, height: SQUARE_SIZE, crop: "pad", background: "white" }]
      : [{ width: SQUARE_SIZE, crop: "limit" }];
  }

  const result = await cloudinary.uploader.upload(fileDataUri, uploadOptions);
  return result.secure_url;
}

module.exports = { uploadImage, SQUARE_SIZE };
