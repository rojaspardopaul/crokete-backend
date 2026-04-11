const express = require("express");
const router = express.Router();
const { sendContactEmail } = require("../controller/contactController");
const { contactLimiter } = require("../lib/security/apiRateLimiter");

router.post("/", contactLimiter, sendContactEmail);

module.exports = router;
