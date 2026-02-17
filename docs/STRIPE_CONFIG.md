# Configuración de Stripe

## El Problema

El error "You should not use your secret key with Stripe.js" ocurre cuando se intenta usar la **clave secreta** de Stripe en el frontend, cuando debería usarse la **clave pública**.

## Diferencia entre las claves

### Clave Pública (Publishable Key)
- Empieza con `pk_test_...` (modo test) o `pk_live_...` (modo production)
- **Se usa en el FRONTEND** (navegador del cliente)
- Es segura para exponerse públicamente
- Se usa con Stripe.js y Elements

### Clave Secreta (Secret Key)
- Empieza con `sk_test_...` (modo test) o `sk_live_...` (modo production)
- **Se usa SOLO en el BACKEND** (servidor)
- NUNCA debe exponerse al cliente
- Se usa para crear cargos, webhooks, etc.

## Configuración Correcta

### 1. Obtén tus claves de Stripe

Ve a [Stripe Dashboard > API Keys](https://dashboard.stripe.com/test/apikeys) y copia:
- **Publishable key** (comienza con `pk_`)
- **Secret key** (comienza con `sk_`)

### 2. Configura el Backend

Crea o edita el archivo `.env` en la raíz del proyecto **crokete-backend**:

```env
# Stripe Configuration
STRIPE_KEY=pk_test_51Hxv8SGSdz8... # TU CLAVE PÚBLICA aquí
STRIPE_SECRET=sk_test_51Hxv8SGSdz8... # TU CLAVE SECRETA aquí
```

### 3. Actualiza la Base de Datos

Ejecuta el script para sincronizar las claves con MongoDB:

```bash
cd crokete-backend
node scripts/fix-stripe-config.js
```

Esto actualizará:
- `storeSetting.stripe_key` → Tu clave pública
- `storeSetting.stripe_secret` → Tu clave secreta
- `storeSetting.stripe_status` → `true`

### 4. Reinicia las Aplicaciones

Reinicia tanto el backend como el frontend:

```bash
# Backend
cd crokete-backend
npm run dev

# Store (en otra terminal)
cd crokete-store
npm run dev
```

## Solución Temporal: Deshabilitar Stripe

Si no tienes claves de Stripe todavía, puedes deshabilitar temporalmente el método de pago:

```bash
cd crokete-backend
node scripts/disable-stripe.js
```

Esto configurará:
- `stripe_status: false`
- Solo estará disponible el **pago contra entrega (COD)**

## Verificación

### En el Frontend
El store debería cargar sin errores de Stripe. Revisa la consola del navegador.

### En el Checkout
- Si Stripe está habilitado: verás las opciones "Tarjeta de Crédito" y "PayPal"
- Si está deshabilitado: solo verás "Pago Contra Entrega"

## Scripts Disponibles

### `update-settings-to-db.js`
Sincroniza TODA la configuración desde `utils/settings.js` a MongoDB:
```bash
node scripts/update-settings-to-db.js
```

### `fix-stripe-config.js`
Actualiza SOLO la configuración de Stripe desde variables de entorno:
```bash
node scripts/fix-stripe-config.js
```

### `disable-stripe.js`
Deshabilita temporalmente Stripe:
```bash
node scripts/disable-stripe.js
```

## Modo Test vs Producción

### Desarrollo (Test Mode)
```env
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
```

### Producción (Live Mode)
```env
STRIPE_KEY=pk_live_...
STRIPE_SECRET=sk_live_...
```

⚠️ **IMPORTANTE**: Nunca compartas tu clave secreta (sk_) públicamente o en repositorios de Git.

## Más Información

- [Stripe API Keys](https://stripe.com/docs/keys)
- [Stripe.js Reference](https://stripe.com/docs/js)
- [Elements Integration](https://stripe.com/docs/payments/elements)
