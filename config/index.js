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
  // CLOUDINARY - GESTIÓN DE IMÁGENES
  // ============================================
  CLOUDINARY: {
    // URL base (sin la imagen)
    BASE_URL: 'https://res.cloudinary.com/dr397rg7u/image/upload/v1770007311/',
    
    // Imágenes centralizadas (solo nombres de archivo)
    IMAGES: {
      // Logo principal de la empresa
      LOGO: 'logo-crokete_omowja.png',
      
      // Agregar más imágenes aquí según sea necesario
      // Ejemplo:
      // BANNER_HOME: 'banner-home.png',
      // ICON_CATEGORY: 'icon-category.png',
    },
    
    /**
     * Método helper para obtener URL completa de una imagen
     * @param {string} imageName - Nombre del archivo de imagen
     * @returns {string} URL completa de la imagen
     */
    getImageUrl(imageName) {
      return this.BASE_URL + imageName;
    },
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
      HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
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
