# Guía: Configurar Dominios Personalizados en GCP

## Situación Actual ✅

Servicios funcionando con URLs de GCP:
- **Admin:** https://storage.googleapis.com/crokete-admin/index.html
- **Backend:** https://backend-service-704205683434.us-south1.run.app
- **Store:** https://store-service-704205683434.us-south1.run.app

DNS en GoDaddy ya configurados:
- `admin.crokete.com.mx` → `ghs.googlehosted.com` (CNAME)
- `backend.crokete.com.mx` → `ghs.googlehosted.com` (CNAME)
- `www.crokete.com.mx` → `crokete.com.mx` (CNAME)

## OPCIÓN A: Configuración Completa (Recomendada - 30 min)

### Paso 1: Verificar Dominio en Google Search Console

1. Ve a https://search.google.com/search-console
2. Inicia sesión con `rojaspardopaul@gmail.com`
3. Clic en "Agregar propiedad"
4. Selecciona "Prefijo de URL": `https://crokete.com.mx`
5. Elige método "Registro DNS"
6. Copia el registro TXT (ejemplo: `google-site-verification=ABC123...`)
7. En GoDaddy → DNS → Agregar registro:
   - Tipo: TXT
   - Nombre: @ (o crokete.com.mx)
   - Valor: [el código que copiaste]
   - TTL: 1 hora
8. Espera 5-10 minutos
9. Vuelve a Search Console y haz clic en "Verificar"

### Paso 2: Mapear Dominios en Cloud Run

Una vez verificado el dominio, ejecuta:

```powershell
# Mapear backend.crokete.com.mx
gcloud beta run domain-mappings create `
  --service=backend-service `
  --domain=backend.crokete.com.mx `
  --region=us-south1 `
  --project=crokete

# Mapear crokete.com.mx (store)
gcloud beta run domain-mappings create `
  --service=store-service `
  --domain=crokete.com.mx `
  --region=us-south1 `
  --project=crokete

# Ver los registros DNS que debes agregar
gcloud beta run domain-mappings describe backend.crokete.com.mx `
  --region=us-south1 `
  --project=crokete

gcloud beta run domain-mappings describe crokete.com.mx `
  --region=us-south1 `
  --project=crokete
```

### Paso 3: Actualizar DNS en GoDaddy

GCP te dará registros DNS específicos. Actualiza en GoDaddy:

**Para backend.crokete.com.mx:**
- Tipo: CNAME
- Nombre: backend
- Valor: [el que te dé GCP, ejemplo: ghs.googlehosted.com]

**Para crokete.com.mx:**
- Tipo: A
- Nombre: @
- Valor: [IPs que te dé GCP]

### Paso 4: Configurar Load Balancer para Admin

```powershell
# Habilitar Compute Engine API
gcloud services enable compute.googleapis.com --project=crokete

# Crear backend bucket
gcloud compute backend-buckets create admin-backend-bucket `
  --gcs-bucket-name=crokete-admin `
  --enable-cdn `
  --project=crokete

# Reservar IP estática
gcloud compute addresses create admin-ip `
  --global `
  --project=crokete

# Crear URL map
gcloud compute url-maps create admin-lb `
  --default-backend-bucket=admin-backend-bucket `
  --project=crokete

# Crear certificado SSL administrado
gcloud compute ssl-certificates create admin-ssl-cert `
  --domains=admin.crokete.com.mx `
  --global `
  --project=crokete

# Crear proxy HTTPS
gcloud compute target-https-proxies create admin-https-proxy `
  --url-map=admin-lb `
  --ssl-certificates=admin-ssl-cert `
  --global `
  --project=crokete

# Obtener la IP reservada
gcloud compute addresses describe admin-ip --global --project=crokete

# Crear regla de forwarding
gcloud compute forwarding-rules create admin-https-rule `
  --global `
  --target-https-proxy=admin-https-proxy `
  --ports=443 `
  --address=admin-ip `
  --project=crokete
```

**Actualiza DNS en GoDaddy:**
- Tipo: A
- Nombre: admin
- Valor: [la IP que obtuviste]

### Paso 5: Actualizar Variables de Entorno

Una vez que los dominios funcionen:

**Backend (.env):**
```env
STORE_URL=https://crokete.com.mx
ADMIN_URL=https://admin.crokete.com.mx
```

**Admin (.env):**
```env
VITE_APP_API_BASE_URL=https://backend.crokete.com.mx/v1
VITE_APP_STORE_DOMAIN=https://crokete.com.mx
VITE_APP_API_SOCKET_URL=https://backend.crokete.com.mx
VITE_APP_ADMIN_DOMAIN=https://admin.crokete.com.mx
```

**Store (.env.local):**
```env
NEXT_PUBLIC_API_BASE_URL=https://backend.crokete.com.mx/v1
NEXT_PUBLIC_API_SOCKET_URL=https://backend.crokete.com.mx
NEXT_PUBLIC_STORE_DOMAIN=https://crokete.com.mx
NEXTAUTH_URL=https://crokete.com.mx
```

Luego redeploy todos los servicios.

---

## OPCIÓN B: Usar URLs de GCP (Ya funcionando)

Si prefieres no configurar dominios ahora, tus servicios ya están funcionando:

```
Admin:   https://storage.googleapis.com/crokete-admin/index.html
Backend: https://backend-service-704205683434.us-south1.run.app
Store:   https://store-service-704205683434.us-south1.run.app
```

Puedes configurar los dominios más tarde cuando tengas tiempo.

---

## Verificación Final

Una vez configurados los dominios:

```powershell
# Probar todos los dominios
.\scripts\test-all-services.ps1

# O manualmente:
curl -I https://backend.crokete.com.mx
curl -I https://admin.crokete.com.mx  
curl -I https://crokete.com.mx
```

## Tiempo Estimado

- Verificar dominio: 10-15 min
- Mapear Cloud Run: 5 min
- Configurar Load Balancer: 10 min
- Actualizar DNS: 5 min
- Esperar propagación DNS: 5-30 min
- Redeploy con nuevas URLs: 10 min

**Total: 45-75 minutos**

## Troubleshooting

### Error: Domain not verified
- Verifica que el registro TXT esté en GoDaddy
- Espera 10 minutos y reintenta
- Verifica con: `nslookup -type=txt crokete.com.mx`

### Error: SSL certificate provisioning
- El certificado SSL tarda 15-30 min en aprovisionarse
- Puedes ver el estado con: `gcloud compute ssl-certificates describe admin-ssl-cert --global`

### Error 502/503 después de configurar
- Los cambios DNS tardan hasta 30 min en propagarse globalmente
- Prueba con modo incógnito o desde otro dispositivo
- Verifica con: `nslookup backend.crokete.com.mx`
