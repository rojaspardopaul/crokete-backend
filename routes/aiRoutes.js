const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");
const { generateProductData, getProviders } = require("../controller/aiProductController");

// Montado bajo isAuth en api/index.js, pero eso sólo exigía una sesión: un
// cliente cualquiera podía generar fichas y consumir la cuota de Gemini/OpenAI
// (que se paga por uso) enviando además imágenes arbitrarias al proveedor.
// Es una herramienta del panel, así que se restringe a administradores.
router.use(isAdmin);

// GET  /ai/providers         → check available AI providers
router.get("/providers", getProviders);

// POST /ai/generate-product  → generate product data with AI
router.post("/generate-product", generateProductData);

module.exports = router;
