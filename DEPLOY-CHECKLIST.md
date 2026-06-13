# Deploy checklist — nuevo proyecto GCP (Crokete backend V2)

El backend compila TypeScript en la imagen y sirve módulos TS/DDD según banderas:
- `USE_TS_CATALOG=true` → `/v1/products` desde `dist/modules/catalog`.
- `USE_TS_ORDERS=true` → `/v1/orders` (panel admin) desde `dist/modules/orders`.

El resto sigue en código legado — en particular el flujo de **cliente y pagos**
(`/v1/order`, webhooks Stripe/PayPal/Razorpay) NO se tocó. Rollback instantáneo
de cualquiera de los dos: poner la bandera correspondiente en `false`.

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

- **Cliente y pagos**: creación de pedidos, payment intents, webhooks
  (Stripe/PayPal/Razorpay) — todo `/v1/order` permanece en el controller legado.
- customers, loyalty, reviews, vet, settings, etc.
- El flujo `OrderPaid`/`confirmPayment` del módulo TS (`MarkOrderPaid` +
  handlers de inventory/loyalty/notifications) es **solo referencia** y NO está
  cableado en producción (lo haría el flujo de pagos legado por duplicado).

## Verificación específica de orders (USE_TS_ORDERS)

Tras desplegar, en el panel admin confirmar: listado de pedidos con filtros,
dashboards (conteos y montos), detalle de pedido, **cambio de estado** (que
dispara correo en `en_reparto`/`entregado` y restaura cupón de lealtad al
cancelar) y borrado. Si algo difiere, `USE_TS_ORDERS=false` y redeploy/env-update.
