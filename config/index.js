/**
 * Configuración centralizada del proyecto Crokete Pet
 * Aquí se definen todas las constantes, URLs y configuraciones globales
 */

const CONFIG = {
  // ============================================
  // INFORMACIÓN DE LA EMPRESA
  // ============================================
  COMPANY: {
    NAME: 'Crokete Pet',
    EMAIL: 'admin@crokete.com.mx',
    SUPPORT_EMAIL: 'soporte@crokete.com.mx',
    PHONE: '+52 3310448051', // Actualizar con teléfono real
    ADDRESS: '', // Actualizar con dirección real
  },

  // ============================================
  // URLs DE LOS SERVICIOS
  // ============================================
  URLS: {
    STORE: process.env.STORE_URL || 'https://store-service-704205683434.us-south1.run.app',
    ADMIN: process.env.ADMIN_URL || 'https://admin-service-kwmalugf6q-vp.a.run.app',
  },

  // ============================================
  // IMÁGENES DE MARCA (Supabase Storage)
  // ============================================
  // Assets fijos que usan las plantillas de correo. No son contenido editable
  // del catálogo: viven en el bucket público y se referencian por URL directa.
  ASSETS: {
    LOGO: 'https://mcvufmicaqrhgwdharub.supabase.co/storage/v1/object/public/crokete/marca/1785042671896-w0e0eevg.webp',
  },

  // ============================================
  // CONFIGURACIÓN DE EMAIL
  // ============================================
  EMAIL: {
    // Formato con nombre visible: "Nombre" <email@dominio.com>
    FROM: '"Crokete Pet" <no-responder@crokete.com.mx>',
    FROM_EMAIL: 'no-responder@crokete.com.mx', // Solo el email
    FROM_NAME: 'Crokete Pet', // Solo el nombre
    REPLY_TO: 'no-responder@crokete.com.mx',
    
    // Configuración SMTP (usar process.env en producción)
    SMTP: {
      HOST: process.env.EMAIL_HOST || process.env.HOST || 'smtp.gmail.com',
      PORT: parseInt(process.env.EMAIL_PORT) || 465,
      SECURE: true,
      USER: process.env.EMAIL_USER,
      PASS: process.env.EMAIL_PASS,
    },
    
    // Límites de envío (para rate limiting)
    RATE_LIMITS: {
      VERIFICATION: {
        WINDOW_MINUTES: 30,
        MAX_ATTEMPTS: 3,
      },
      PASSWORD_RESET: {
        WINDOW_MINUTES: 30,
        MAX_ATTEMPTS: 3,
      },
      SUPPORT: {
        WINDOW_MINUTES: 30,
        MAX_ATTEMPTS: 5,
      },
      PHONE_VERIFICATION: {
        WINDOW_MINUTES: 30,
        MAX_ATTEMPTS: 2,
      },
    },
  },

  // ============================================
  // REDES SOCIALES (opcional)
  // ============================================
  SOCIAL_MEDIA: {
    FACEBOOK: '',
    INSTAGRAM: '',
    TWITTER: '',
    WHATSAPP: '',
  },

  // ============================================
  // CONFIGURACIÓN DE PAGOS (opcional)
  // ============================================
  PAYMENTS: {
    // Agregar configuraciones de métodos de pago aquí
  },
};

module.exports = CONFIG;
