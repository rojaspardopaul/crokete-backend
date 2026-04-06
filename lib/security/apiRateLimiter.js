const rateLimit = require("express-rate-limit");

/**
 * Rate limiter global — 100 requests por minuto por IP.
 * Se aplica a todas las rutas.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes. Por favor intenta de nuevo en un momento.",
  },
});

/**
 * Rate limiter para búsqueda — 30 requests por minuto por IP.
 * Se aplica a /v1/products/ (endpoints públicos de productos).
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas búsquedas. Por favor intenta de nuevo en un momento.",
  },
});

/**
 * Rate limiter para pagos — 10 requests por minuto por IP.
 * Se aplica a /v1/order/ (creación de órdenes / checkout).
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes de pago. Por favor intenta de nuevo en un momento.",
  },
});

module.exports = { globalLimiter, searchLimiter, paymentLimiter };
