#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-backend.sh PROJECT_ID REGION
PROJECT_ID=${1:-crokete}
REGION=${2:-us-south1}

SHORT_SHA=$(git rev-parse --short HEAD || echo "local")
IMAGE="gcr.io/$PROJECT_ID/backend-image:$SHORT_SHA"

echo "Building Docker image $IMAGE..."
docker build -t "$IMAGE" .

echo "Pushing image to Container Registry..."
docker push "$IMAGE"

echo "Deploying to Cloud Run (project=$PROJECT_ID region=$REGION)..."
gcloud run deploy backend-service \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets=MONGO_URI=mongo-uri-secret:latest,JWT_SECRET=jwt-secret:latest,JWT_SECRET_FOR_VERIFY=jwt-secret-for-verify:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,ENCRYPT_PASSWORD=encrypt-password-secret:latest,STRIPE_KEY=stripe-key-secret:latest,STRIPE_SECRET=stripe-secret-secret:latest,CLOUDINARY_URL=cloudinary-url-secret:latest,PAYPAL_CLIENT_ID=paypal-client-id-secret:latest,PAYPAL_APP_SECRET=paypal-app-secret-secret:latest,EMAIL_USER=email-user-secret:latest,EMAIL_PASS=email-pass-secret:latest,TWILIO_ACCOUNT_SID=twilio-sid-secret:latest,TWILIO_AUTH_TOKEN=twilio-token-secret:latest,GOOGLE_CLIENT_ID=google-client-id-secret:latest,GOOGLE_CLIENT_SECRET=google-client-secret-secret:latest,NEXTAUTH_SECRET=nextauth-secret:latest,STORE_URL=store-url-secret:latest,ADMIN_URL=admin-url-secret:latest

echo "Deployment finished."