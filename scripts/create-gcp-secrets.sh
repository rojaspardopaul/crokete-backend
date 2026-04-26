#!/usr/bin/env bash
# create-gcp-secrets.sh
# Lee tu archivo .env y crea todos los secrets en GCP Secret Manager.
# Uso: bash scripts/create-gcp-secrets.sh
# Prerequisito: gcloud auth login y gcloud config set project TU_PROJECT_ID

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No se encontró '$ENV_FILE'. Copia .env.example a .env y llena los valores."
  exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: No hay proyecto activo. Ejecuta: gcloud config set project TU_PROJECT_ID"
  exit 1
fi

echo "Proyecto: $PROJECT_ID"
echo "Leyendo: $ENV_FILE"
echo ""

# Mapa: variable de entorno → nombre del secret en GCP
declare -A SECRET_MAP=(
  [MONGO_URI]="mongo-uri-secret"
  [JWT_SECRET]="jwt-secret"
  [JWT_REFRESH_SECRET]="jwt-refresh-secret"
  [JWT_SECRET_FOR_VERIFY]="jwt-secret-for-verify"
  [ENCRYPT_PASSWORD]="encrypt-password-secret"
  [STRIPE_KEY]="stripe-key-secret"
  [STRIPE_SECRET]="stripe-secret-secret"
  [STRIPE_WEBHOOK_SECRET]="stripe-webhook-secret"
  [CLOUDINARY_URL]="cloudinary-url-secret"
  [PAYPAL_CLIENT_ID]="paypal-client-id-secret"
  [PAYPAL_APP_SECRET]="paypal-app-secret-secret"
  [EMAIL_USER]="email-user-secret"
  [EMAIL_PASS]="email-pass-secret"
  [HOST]="email-host-secret"
  [EMAIL_PORT]="email-port-secret"
  [TWILIO_ACCOUNT_SID]="twilio-sid-secret"
  [TWILIO_AUTH_TOKEN]="twilio-token-secret"
  [GOOGLE_CLIENT_ID]="google-client-id-secret"
  [GOOGLE_CLIENT_SECRET]="google-client-secret-secret"
  [NEXTAUTH_SECRET]="nextauth-secret"
  [STORE_URL]="store-url-secret"
  [ADMIN_URL]="admin-url-secret"
  [GEMINI_API_KEY]="gemini-api-key-secret"
  [OPENAI_API_KEY]="openai-api-key-secret"
)

# Leer valores del archivo .env
declare -A ENV_VALUES
while IFS='=' read -r key value; do
  # Ignorar comentarios y líneas vacías
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  # Quitar espacios y comillas
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/" | xargs)
  ENV_VALUES["$key"]="$value"
done < "$ENV_FILE"

# Crear o actualizar cada secret
for env_var in "${!SECRET_MAP[@]}"; do
  secret_name="${SECRET_MAP[$env_var]}"
  value="${ENV_VALUES[$env_var]:-}"

  if [[ -z "$value" ]]; then
    echo "⚠️  OMITIDO: $env_var (vacío en .env) → $secret_name"
    continue
  fi

  # Verificar si el secret ya existe
  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --project="$PROJECT_ID"
    echo "✅ ACTUALIZADO: $secret_name"
  else
    echo -n "$value" | gcloud secrets create "$secret_name" --data-file=- --project="$PROJECT_ID"
    echo "✅ CREADO:      $secret_name"
  fi
done

echo ""
echo "Listo. Verifica con: gcloud secrets list --project=$PROJECT_ID"
