/**
 * Upload controller — centralized image uploads for the admin panel.
 * Receives a data-URI, normalizes via Cloudinary (webp + uniform size) and
 * returns the final URL. Images are processed/stored by Cloudinary only.
 */
const { uploadImage } = require("../lib/cloudinary/uploader");

const ALLOWED = /^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,/i;

const uploadProductImage = async (req, res) => {
  try {
    const { file, folder, square } = req.body;

    if (!file || typeof file !== "string" || !ALLOWED.test(file)) {
      return res.status(400).send({
        message:
          "Imagen no válida. Formatos permitidos: JPG, PNG, WEBP, GIF o SVG.",
      });
    }

    const isSvg = /^data:image\/svg\+xml/i.test(file);

    const url = await uploadImage(file, {
      folder: folder || "crokete",
      square: square !== false, // default true (uniform square for products)
      isSvg,
    });

    return res.status(200).send({ url });
  } catch (err) {
    console.error("[Upload] Error:", err.message);
    return res.status(500).send({
      message: "No se pudo subir la imagen. Inténtalo de nuevo.",
    });
  }
};

module.exports = { uploadProductImage };
