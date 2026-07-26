# Crokete Backend

API REST del e-commerce Crokete: Node.js + Express, PostgreSQL (Supabase) con Prisma.

- **Producción:** https://backend.crokete.com.mx (Railway)
- **Tienda:** https://crokete.com.mx (Vercel)
- **Panel:** https://admin.crokete.com.mx (Vercel)

---

## 💻 Desarrollo local

```bash
npm install
cp .env.example .env       # y rellenar credenciales
npm run build:ts           # genera el cliente Prisma y compila src/ → dist/
npm run dev                # http://localhost:5055
```

`npm run dev` necesita un `build:ts` previo: el cliente Prisma y los módulos
TypeScript se cargan desde `dist/`, que no se versiona.

### Comandos

```bash
npm run dev          # hot-reload (nodemon)
npm start            # arranque de producción
npm run build:ts     # prisma generate + tsc
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run init:admin   # crear el super admin (una sola vez)
npm run openapi:gen  # regenerar openapi.json desde los contratos zod

npx prisma migrate deploy   # aplicar migraciones pendientes
npx prisma migrate dev      # crear una migración nueva en desarrollo
npx prisma studio           # explorar la base de datos
```

---

## 🚀 Despliegue

Railway construye la imagen desde el `Dockerfile` y despliega con cada `git push`.
El `Dockerfile` corre `npm run build:ts` (que incluye `prisma generate`, necesario
porque el cliente no está versionado) y luego descarta las devDependencies.

Las variables de entorno se configuran en el panel de Railway — ver la lista en
[.env.example](.env.example). El healthcheck apunta a `GET /health`, que hace un
`SELECT 1` contra Postgres y responde 503 si la base no está accesible.

Tras un cambio de esquema hay que aplicar las migraciones (`npx prisma migrate
deploy`) contra la base de Supabase.

---

## 🏗️ Estructura

```
crokete-backend/
├── api/              # Punto de entrada (middleware, montaje de rutas)
├── routes/           # Definición de rutas
├── controller/       # Controladores HTTP
├── lib/
│   ├── prisma/       # Cliente, presentadores y consultas compartidas
│   ├── email-sender/ # Plantillas y envío SMTP
│   ├── storage/      # Subida de imágenes a Supabase Storage
│   ├── stripe/       # Pagos
│   └── ai/           # Generación de fichas con Gemini/OpenAI
├── prisma/           # Esquema y migraciones (fuente de verdad del modelo)
├── src/              # Módulos TypeScript/DDD, contratos zod y OpenAPI
├── config/           # Auth y constantes de la empresa
├── utils/            # Caché, jerarquía de categorías, configuración
├── scripts/          # init-super-admin
└── docs/             # Seguridad y configuración de Stripe
```

---

## 🔐 Variables de entorno

Imprescindibles: `DATABASE_URL`, los tres secretos JWT, `ENCRYPT_PASSWORD`
(32 hex, debe coincidir con `VITE_APP_ENCRYPT_PASSWORD` del panel), las claves de
Stripe, el SMTP, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para las imágenes y
`STORE_URL` + `ADMIN_URL` para CORS.

La lista completa, con ejemplos y las opcionales (Gemini/OpenAI, Google OAuth,
Twilio), está en [.env.example](.env.example).

Al arrancar, `syncEnvToDb` copia a la tabla `Setting` las claves que estén vacías
en la base, de modo que el panel pueda editarlas en caliente. Las variables de
entorno siempre tienen prioridad sobre lo guardado en la base.

---

## 🐛 Diagnóstico

El arranque imprime un resumen de configuración (Stripe, email, OAuth, Supabase
Storage, webhook) señalando lo que falta o no concuerda.

| Síntoma | Dónde mirar |
|---|---|
| `/health` responde 503 | `DATABASE_URL` y el estado del proyecto en Supabase |
| Error CORS | `STORE_URL` / `ADMIN_URL` deben ser el origen exacto, sin comodines |
| Webhooks de Stripe fallando | La URL del endpoint en el panel de Stripe y `STRIPE_WEBHOOK_SECRET` |
| "Prisma Client no compilado" | Falta `npm run build:ts` |

Más detalle en [docs/SEGURIDAD.md](docs/SEGURIDAD.md) y
[docs/STRIPE_CONFIG.md](docs/STRIPE_CONFIG.md).

---

## 🔒 Seguridad

- **No** commitear `.env`
- Rotar secretos periódicamente y revocar de inmediato cualquiera que se exponga
- Valores distintos entre desarrollo y producción
- `SUPABASE_SERVICE_ROLE_KEY` salta las políticas RLS: nunca debe llegar al navegador

---

## 📝 Stack

- Node.js 18 · Express
- PostgreSQL (Supabase) · Prisma 7
- TypeScript en los módulos de dominio (`src/modules`), contratos con zod
- JWT para autenticación · AES-256-CBC para datos sensibles
- Stripe (tarjeta) y efectivo contra entrega
- Supabase Storage para imágenes (normalizadas a webp con sharp)
- Railway para el hosting

---

## 📄 Licencia

Regular License
