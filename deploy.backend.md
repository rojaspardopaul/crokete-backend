# Deploy backend to Google Cloud Run

Prerequisites:

- `gcloud` installed and authenticated
- Billing enabled on the GCP project
- `docker` installed and authenticated to push to GCR

Steps (summary):

1. Create secrets in Secret Manager:

```bash
gcloud secrets create mongo-uri-secret --replication-policy="automatic"
echo -n "YOUR_MONGO_URI" | gcloud secrets versions add mongo-uri-secret --data-file=-

gcloud secrets create stripe-secret --replication-policy="automatic"
echo -n "YOUR_STRIPE_SECRET" | gcloud secrets versions add stripe-secret --data-file=-
```

2. Build and deploy using the provided script (from repo root):

```bash
chmod +x scripts/deploy-backend.sh
./scripts/deploy-backend.sh YOUR_PROJECT_ID us-central1
```

3. Alternatively use Cloud Build:

```bash
gcloud builds submit --substitutions=_REGION=us-central1 --config cloudbuild.yaml
```

Notes:
- The `cloudbuild.yaml` example sets `MONGO_URI` and `STRIPE_SECRET` from Secret Manager; update secret names if you choose different ones.
- Rotate any leaked credentials immediately and do not store secrets in the repo.