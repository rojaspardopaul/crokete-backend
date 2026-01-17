# Crokete / KachaBazar Backend

## Secrets & Local Setup

Resumen rápido
- Las claves secretas ya no están en el código fuente: se reemplazaron por variables de entorno en `utils/settings.js`.
- Aun así debes ROTAR/REVOCAR las claves que se publicaron antes de la limpieza (Google OAuth, Stripe).

### Variables necesarias
- `GOOGLE_CLIENT_ID` — Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth Client Secret
- `NEXTAUTH_SECRET` — secreto para NextAuth (cadena larga y aleatoria)
- `STRIPE_KEY` — Stripe publishable key (pk_test_...)
- `STRIPE_SECRET` — Stripe secret key (sk_test_...)
- Otros: `JWT_SECRET`, `ENCRYPT_PASSWORD`, `MONGO_URI` (ya listadas en `.env.example`)

### Uso local
1. Copia `.env.example` a `.env`:

```bash
cp .env.example .env
# en PowerShell:
# Copy-Item .env.example .env
```

2. Rellena las variables en `.env` con las claves obtenidas desde los dashboards de terceros.

3. No cometas tu `.env` al repositorio. `.gitignore` ya excluye `.env`.

### Rotar / obtener claves
- Google OAuth: Google Cloud Console → Credentials → crear nuevo OAuth 2.0 Client ID y Secret → actualizar `.env`.
- Stripe: Dashboard → Developers → API keys → revoca la `sk_*` y genera nueva.

### Nota
- Aunque el historial se limpió, rota las claves expuestas.
- Después de la reescritura de la historia, colaboradores deben volver a clonar:

```bash
git clone https://github.com/rojaspardopaul/crokete-backend.git
```

¿Quieres que añada un `env.sample` más completo o un script para validar variables en tiempo de arranque?