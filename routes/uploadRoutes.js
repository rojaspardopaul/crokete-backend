const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");
const { uploadProductImage } = require("../controller/uploadController");

// Mounted under isAuth in api/index.js; admin-only.
router.post("/image", isAdmin, uploadProductImage);

module.exports = router;
