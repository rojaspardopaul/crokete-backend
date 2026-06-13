# Deploy checklist — nuevo proyecto GCP (Crokete backend V2)

El backend ahora compila TypeScript en la imagen y, con `USE_TS_CATALOG=true`,
sirve `/v1/products` desde el módulo TS/DDD (`dist/modules/catalog`). El resto de
la API sigue en el código legado. Rollback instantáneo: poner `USE_TS_CATALOG=false`.

## Qué cambió para el deploy

- **Dockerfile**: instala todas las deps → `npm run build:ts` (genera `dist/`) →
  `npm prune --omit=dev` → `npm start`. La imagen final no lleva devDeps.
- **cloudbuild.yaml**: agrega `USE_TS_CATALOG=true` a `--set-env-vars`.
- **package.json**: `@asteasolutions/zod-to-openapi` y `zod` son ahora deps de
  runtime (el controller valida con los esquemas Zod en ejecución).

## Pasos en el nuevo proyecto GCP

1. **Habilitar APIs**: Cloud Build, Cloud Run, Artifact Registry, Secret Manager.
2. **Artifact Registry**: crear el repo Docker usado en `cloudbuild.yaml`:
   ```bash
   gcloud artifacts repositories create backend-repo \
     --repository-format=docker --location=us-south1
   ```
   (Ajustar región/nombre si cambias `cloudbuild.yaml`.)
3. **Secret Manager**: crear TODOS los secretos referenciados en `--set-secrets`:
   `mongo-uri-secret, jwt-secret, jwt-secret-for-verify, jwt-refresh-secret,
   encrypt-password-secret, stripe-key-secret, stripe-secret-secret,
   stripe-webhook-secret, cloudinary-url-secret, paypal-client-id-secret,
   paypal-app-secret-secret, email-user-secret, email-pass-secret,
   email-host-secret, email-port-secret, twilio-sid-secret, twilio-token-secret,
   google-client-id-secret, google-client-secret-secret, nextauth-secret,
   store-url-secret, admin-url-secret, gemini-api-key-secret, openai-api-key-secret`.
   ```bash
   printf "VALOR" | gcloud secrets create mongo-uri-secret --data-file=-
   ```
4. **Permisos**: dar al runtime service account de Cloud Run el rol
   `roles/secretmanager.secretAccessor`; a Cloud Build los roles para desplegar
   en Cloud Run (`roles/run.admin`, `roles/iam.serviceAccountUser`).
5. **Desplegar**:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml --project=<NUEVO_PROJECT_ID>
   ```
6. **Verificar**:
   - `GET /health` → 200 `{ status: "ok" }`.
   - En logs debe aparecer `🟢 Catalog: módulo TypeScript/DDD activo`.
   - `GET /v1/products/store` y `GET /v1/products/product/:slug` responden.
   - El admin puede crear/editar/borrar productos; la store lista y busca.

## Rollback

Sin redeploy de imagen: actualizar la variable de entorno en Cloud Run.
```bash
gcloud run services update backend-service --region us-south1 \
  --update-env-vars USE_TS_CATALOG=false
```
Vuelve al controller legado al instante.

## Importante: lo que NO cambió (sigue en legado)

- Orders / pagos / webhooks (Stripe, PayPal, Razorpay), customers, loyalty,
  reviews, categorías, marcas, vet, settings, etc.
- El módulo `src/modules/orders` (flujo `OrderPaid`) es **solo referencia** y NO
  está cableado en producción (cablearlo duplicaría el descuento de stock y los
  puntos que ya hace el flujo legado). No activarlo aún.
