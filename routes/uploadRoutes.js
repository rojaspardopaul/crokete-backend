const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");
const {
  uploadProductImage,
  uploadCustomerImage,
} = require("../controller/uploadController");

// Todas las rutas están bajo isAuth en api/index.js.

// Catálogo y panel: admin.
router.post("/image", isAdmin, uploadProductImage);

// Foto de perfil y fotos de reseñas: basta con ser un cliente autenticado.
router.post("/customer-image", uploadCustomerImage);

module.exports = router;
