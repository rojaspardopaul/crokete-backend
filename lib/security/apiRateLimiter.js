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

/**
 * Rate limiter para el formulario de contacto — 5 envíos por hora por IP.
 * Evita spam y abuso del endpoint público.
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Has enviado demasiados mensajes. Por favor intenta de nuevo en una hora.",
  },
});

/**
 * Rate limiter para login/registro — 10 intentos por 15 minutos por IP.
 * Mitiga ataques de fuerza bruta en endpoints de autenticación.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos de acceso. Por favor intenta de nuevo en 15 minutos.",
  },
});

/**
 * Rate limiter para subida de imágenes — 20 por minuto por IP.
 * Cada subida admite hasta 15 MB y se procesa con sharp (recodificar a webp y
 * redimensionar), así que con el límite global de 100/min un solo usuario
 * autenticado podía saturar CPU y memoria del contenedor, además de llenar el
 * bucket. 20/min sobra para dar de alta un producto con varias fotos.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas imágenes en poco tiempo. Espera un momento e inténtalo de nuevo.",
  },
});

module.exports = { globalLimiter, searchLimiter, paymentLimiter, contactLimiter, loginRateLimiter, uploadLimiter };
