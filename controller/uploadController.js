/**
 * Upload controller — subida centralizada de imágenes.
 * Recibe un data-URI, lo normaliza (webp + tamaño uniforme) y devuelve la URL
 * final. El procesado es con sharp y el destino Supabase Storage.
 */
const { uploadImage } = require("../lib/storage/uploader");

const ALLOWED = /^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,/i;
/** Los clientes no suben SVG: es el único formato que viaja sin re-procesar. */
const ALLOWED_CUSTOMER = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

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

/**
 * Subida para clientes autenticados: foto de perfil y fotos en las reseñas.
 *
 * Existe aparte de la de administración porque la tienda subía estas imágenes
 * directamente a Cloudinary desde el navegador con un upload preset público. Al
 * retirar Cloudinary eso dejó de funcionar, y abrir el endpoint de admin no es
 * opción: el cliente no elige carpeta ni formato ni sube SVG, y el destino queda
 * acotado a `clientes/` en lugar del catálogo.
 */
const uploadCustomerImage = async (req, res) => {
  try {
    const { file } = req.body;

    if (!file || typeof file !== "string" || !ALLOWED_CUSTOMER.test(file)) {
      return res.status(400).send({
        message: "Imagen no válida. Formatos permitidos: JPG, PNG o WEBP.",
      });
    }

    const url = await uploadImage(file, { folder: "clientes", square: true });

    return res.status(200).send({ url });
  } catch (err) {
    console.error("[Upload] Error:", err.message);
    return res.status(500).send({
      message: "No se pudo subir la imagen. Inténtalo de nuevo.",
    });
  }
};

module.exports = { uploadProductImage, uploadCustomerImage };
