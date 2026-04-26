# Despliegue — Backend (GCP Cloud Run)

El backend se despliega automáticamente a GCP Cloud Run cada vez que haces `git push` a la rama `main`. Esta guía cubre el **setup inicial** (una sola vez).

---

## Prerequisitos

- Cuenta de Google Cloud con facturación habilitada
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) instalado
- Docker instalado (solo para pruebas locales)
- Tu repositorio en GitHub

---

## Paso 1 — Crear proyecto GCP y habilitar APIs

```bash
# Login
gcloud auth login

# Crear proyecto (cambia "crokete" por tu ID deseado — debe ser único globalmente)
gcloud projects create crokete --name="Crokete"
gcloud config set project crokete

# Habilitar todas las APIs necesarias
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

> Vincula la cuenta de facturación al proyecto en: https://console.cloud.google.com/billing

---

## Paso 2 — Crear repositorio en Artifact Registry

```bash
gcloud artifacts repositories create backend-repo \
  --repository-format=docker \
  --location=us-south1 \
  --description="Backend Docker images"
```

---

## Paso 3 — Permisos para Cloud Build

```bash
PROJECT_NUMBER=$(gcloud projects describe crokete --format="value(projectNumber)")

# Cloud Build necesita poder desplegar a Cloud Run
gcloud projects add-iam-policy-binding crokete \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Cloud Build necesita leer secrets
gcloud projects add-iam-policy-binding crokete \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Build necesita usar la cuenta de servicio de Compute
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Artifact Registry — permiso para subir imágenes
gcloud projects add-iam-policy-binding crokete \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

---

## Paso 4 — Crear secrets en Secret Manager

Copia `.env.example` a `.env` y llena todos los valores. Luego ejecuta:

```bash
bash scripts/create-gcp-secrets.sh
```

El script lee tu `.env` y crea (o actualiza) cada secret automáticamente.

**Para actualizar un solo secret en el futuro:**
```bash
echo -n "nuevo-valor" | gcloud secrets versions add mongo-uri-secret --data-file=-
```

---

## Paso 5 — Conectar Cloud Build con GitHub

1. Ve a: https://console.cloud.google.com/cloud-build/triggers
2. Clic en **"Conectar repositorio"**
3. Selecciona **GitHub (Cloud Build GitHub App)**
4. Autoriza la app en GitHub y selecciona el repo `crokete-backend`

---

## Paso 6 — Crear trigger de despliegue automático

```bash
gcloud builds triggers create github \
  --name="deploy-backend-main" \
  --repo-name="crokete-backend" \
  --repo-owner="TU_USUARIO_GITHUB" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --project="crokete"
```

> Reemplaza `TU_USUARIO_GITHUB` con tu usuario u organización de GitHub.

---

## Paso 7 — Primer despliegue

```bash
git push origin main
```

Monitorea el build en: https://console.cloud.google.com/cloud-build/builds

El primer build tarda ~5 min. Los siguientes ~2-3 min.

---

## Paso 8 — Obtener la URL del servicio

```bash
gcloud run services describe backend-service \
  --region=us-south1 \
  --format="value(status.url)"
```

Esta URL es tu `NEXT_PUBLIC_API_BASE_URL` + `/v1` para el store y admin.

---

## Paso 9 — Crear super admin (una sola vez)

```bash
# En tu .env local con MONGO_URI apuntando a producción:
npm run init:admin
```

---

## Paso 10 — Configurar dominio personalizado (opcional)

```bash
gcloud run domain-mappings create \
  --service=backend-service \
  --domain=api.tudominio.com \
  --region=us-south1
```

Agrega el registro DNS indicado en la consola.

---

## Despliegues futuros

Solo haz `git push origin main`. Cloud Build detecta el push y despliega automáticamente en ~2-3 min.

```bash
git add .
git commit -m "descripción del cambio"
git push origin main
```

## Actualizar un secret en producción

```bash
echo -n "nuevo-valor" | gcloud secrets versions add nombre-secret --data-file=-
# Luego redespliega para que Cloud Run lo use:
git commit --allow-empty -m "redeploy: actualizar config"
git push origin main
```

---

## Variables de entorno — referencia

| Variable | Secret Manager | Descripción |
|---|---|---|
| `MONGO_URI` | `mongo-uri-secret` | Cadena de conexión MongoDB Atlas |
| `JWT_SECRET` | `jwt-secret` | Secret para access tokens |
| `JWT_REFRESH_SECRET` | `jwt-refresh-secret` | Secret para refresh tokens |
| `JWT_SECRET_FOR_VERIFY` | `jwt-secret-for-verify` | Secret para tokens de verificación |
| `ENCRYPT_PASSWORD` | `encrypt-password-secret` | 32 chars hex — debe coincidir con admin |
| `STRIPE_KEY` | `stripe-key-secret` | Publishable key de Stripe |
| `STRIPE_SECRET` | `stripe-secret-secret` | Secret key de Stripe |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook-secret` | Webhook signing secret de Stripe |
| `CLOUDINARY_URL` | `cloudinary-url-secret` | URL completa con credenciales |
| `EMAIL_USER` | `email-user-secret` | Email SMTP |
| `EMAIL_PASS` | `email-pass-secret` | Password SMTP |
| `HOST` | `email-host-secret` | Host SMTP (ej: smtp.zoho.com) |
| `EMAIL_PORT` | `email-port-secret` | Puerto SMTP (ej: 465) |
| `STORE_URL` | `store-url-secret` | URL pública del store (CORS) |
| `ADMIN_URL` | `admin-url-secret` | URL pública del admin (CORS) |
| `NEXTAUTH_SECRET` | `nextauth-secret` | Debe coincidir con NEXTAUTH_SECRET del store |
