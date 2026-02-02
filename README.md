# Crokete Backend

Backend API para el sistema de e-commerce Crokete, desplegado en Google Cloud Run.

## 🚀 Despliegue Rápido

### Pre-requisitos
- Google Cloud SDK instalado y autenticado
- Proyecto GCP: `crokete`
- Cloud Run, Secret Manager y Cloud Build habilitados

### Desplegar

```bash
# 1. Verificar secretos
.\scripts\verify-secrets.ps1 crokete

# 2. Si faltan secretos, crearlos
.\scripts\create-missing-secrets.ps1 crokete

# 3. Agregar valores a los secretos (ver docs/secrets-guide.md)

# 4. Desplegar con Cloud Build
gcloud builds submit --config=cloudbuild.yaml --project=crokete
```

### Probar Backend

```bash
# PowerShell
.\scripts\test-backend.ps1

# Bash
chmod +x scripts/test-backend.sh
./scripts/test-backend.sh
```

**URL de producción:** https://backend-service-704205683434.us-south1.run.app

---

## 📚 Documentación

- **[DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** - Guía completa de despliegue y pruebas
- **[secrets-guide.md](docs/secrets-guide.md)** - Gestión de secretos en GCP
- **[deploy-full.md](docs/deploy-full.md)** - Despliegue de los 3 proyectos (Backend + Admin + Store)
- **[deploy-summary.md](docs/deploy-summary.md)** - Resumen ejecutivo del despliegue

---

## 🔐 Secretos & Variables de Entorno

El backend requiere **19 secretos** en GCP Secret Manager:

### Autenticación
- `mongo-uri-secret` - MongoDB connection URI
- `jwt-secret` - JWT para tokens de acceso
- `jwt-secret-for-verify` - JWT para verificación de email
- `jwt-refresh-secret` - JWT para refresh tokens
- `encrypt-password-secret` - Clave de encriptación
- `nextauth-secret` - Secret de NextAuth

### Pagos
- `stripe-key-secret` - Stripe publishable key
- `stripe-secret-secret` - Stripe secret key
- `paypal-client-id-secret` - PayPal Client ID
- `paypal-app-secret-secret` - PayPal App Secret

### Servicios Externos
- `cloudinary-url-secret` - URL de Cloudinary
- `email-user-secret` - Email para notificaciones
- `email-pass-secret` - Contraseña de email
- `twilio-sid-secret` - Twilio Account SID
- `twilio-token-secret` - Twilio Auth Token

### OAuth
- `google-client-id-secret` - Google OAuth Client ID
- `google-client-secret-secret` - Google OAuth Client Secret

### URLs
- `store-url-secret` - URL del frontend de la tienda
- `admin-url-secret` - URL del panel de administración

Ver [docs/secrets-guide.md](docs/secrets-guide.md) para instrucciones detalladas.

---

## 💻 Desarrollo Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales locales.

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:5055`

---

## 🧪 Scripts Disponibles

### Despliegue y Verificación

```bash
# Verificar secretos en GCP
.\scripts\verify-secrets.ps1 crokete

# Crear secretos faltantes
.\scripts\create-missing-secrets.ps1 crokete

# Probar backend desplegado
.\scripts\test-backend.ps1

# Desplegar con script bash
chmod +x deploy.backend.sh
./deploy.backend.sh crokete us-south1
```

### Desarrollo

```bash
# Desarrollo con hot-reload
npm run dev

# Producción local
npm run production

# Iniciar servidor
npm start

# Importar datos de prueba
npm run data:import

# Generar contraseñas
npm run generate-password
```

---

## 🏗️ Estructura del Proyecto

```
crokete-backend/
├── api/              # Punto de entrada de la aplicación
├── config/           # Configuración (DB, Auth)
├── controller/       # Controladores de rutas
├── lib/              # Librerías (email, pagos, etc.)
├── models/           # Modelos de MongoDB
├── routes/           # Definición de rutas
├── scripts/          # Scripts de utilidad y despliegue
├── utils/            # Funciones auxiliares
├── docs/             # Documentación
├── Dockerfile        # Configuración de Docker
├── cloudbuild.yaml   # Cloud Build config
└── package.json      # Dependencias
```

---

## 🔗 Enlaces Útiles

- **Backend API:** https://backend-service-704205683434.us-south1.run.app
- **Admin Panel:** https://admin.crokete.com.mx
- **Store Frontend:** https://crokete.com.mx
- **Cloud Console:** https://console.cloud.google.com/run?project=crokete
- **Secret Manager:** https://console.cloud.google.com/security/secret-manager?project=crokete

---

## 🐛 Troubleshooting

### Backend no inicia

```bash
# Ver logs
gcloud run services logs read backend-service --region=us-south1 --limit=50
```

### Error de conexión a MongoDB

```bash
# Verificar secret
gcloud secrets versions access latest --secret=mongo-uri-secret --project=crokete
```

### Error CORS

Asegúrate de que `store-url-secret` y `admin-url-secret` tengan las URLs correctas.

Ver más en [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md#-troubleshooting)

---

## 🔒 Seguridad

- **NO** commitear archivos `.env` al repositorio
- Rotar secretos cada 90 días
- Usar diferentes valores entre desarrollo y producción
- Revocar inmediatamente cualquier secreto expuesto

---

## 📝 Tecnologías

- Node.js 18
- Express.js
- MongoDB + Mongoose
- JWT para autenticación
- Stripe & PayPal para pagos
- Cloudinary para imágenes
- Socket.io para notificaciones en tiempo real
- Cloud Run para hosting

---

## 📄 Licencia

Regular License