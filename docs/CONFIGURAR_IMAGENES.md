# Configuración de Imágenes y Logos

## Problema Actual

El sistema está intentando cargar imágenes de cuentas de Cloudinary antiguas (de la plantilla KachaBazar), lo que causa errores 404 y muestra contenido antiguo.

## Estado Actual

Ejecuta este comando para ver todas las imágenes que necesitan configurarse:

```bash
cd crokete-backend
node scripts/check-image-urls.js
```

**Resumen actual:**
- 📸 Total de imágenes: 29
- ⚠️ Imágenes de cuentas antiguas: 28
- 📭 Logos deshabilitados temporalmente: 2 (navbar y footer)

## Imágenes que Necesitan Configurarse

### Críticas (visibles inmediatamente)
1. **Logo del Navbar** - `navbar.logo`
2. **Logo del Footer** - `footer.block4_logo`
3. **Favicon** - `seo.favicon`
4. **Sliders del Home** (3 imágenes) - `slider.first_img`, `slider.second_img`, `slider.third_img`

### Importantes
5. **Imágenes del About Us** - 6 fotos del equipo fundador
6. **Banner de entrega rápida** - `home.quick_delivery_img`
7. **Imagen de Contact Us** - `contact_us.left_col_img`
8. **Métodos de pago** - `footer.payment_method_img`

### Opcionales
9. Headers de páginas (About, Contact, FAQ, Privacy, Terms)
10. Imágenes de descarga de app (si tienes app móvil)
11. Imagen de FAQ

## Opción 1: Usar el Panel de Administración (Recomendado)

Esta es la forma más fácil. El panel de administración tiene una sección de "Store Customization" donde puedes subir imágenes directamente.

### Pasos:

1. **Inicia el backend y admin:**
   ```bash
   # Terminal 1 - Backend
   cd crokete-backend
   npm run dev

   # Terminal 2 - Admin
   cd crokete-admin
   npm run dev
   ```

2. **Accede al panel de administración:**
   - URL: http://localhost:5173 (o el puerto configurado)
   - Inicia sesión con tus credenciales de admin

3. **Ve a "Settings" > "Store Customization"**

4. **Sube tus imágenes en las secciones:**
   - **General Settings**: Logo del navbar
   - **Home Page**: Sliders, banners
   - **About Us**: Fotos del equipo
   - **Footer**: Logo del footer, métodos de pago
   - **SEO**: Favicon, meta image

5. **Guarda los cambios** - Se actualizará automáticamente en MongoDB

## Opción 2: Usar tu Propia Cuenta de Cloudinary

Si prefieres tener control total sobre tus imágenes:

### 1. Crea una cuenta en Cloudinary

- Ve a: https://cloudinary.com/
- Regístrate gratis (plan gratuito incluye 25GB)

### 2. Configura las credenciales en el backend

Agrega a tu archivo `.env`:

```env
CLOUDINARY_NAME=tu-nombre-de-cloudinary
CLOUDINARY_KEY=tu-api-key
CLOUDINARY_SECRET=tu-api-secret
```

### 3. Sube tus imágenes

Sube tus imágenes a Cloudinary y copia las URLs públicas.

### 4. Actualiza settings.js

Edita `crokete-backend/utils/settings.js` y reemplaza las URLs:

```javascript
// Ejemplo - Navbar
"logo": "https://res.cloudinary.com/TU-CUENTA/image/upload/v1234567890/crokete/logo.svg"

// Ejemplo - Footer
"block4_logo": "https://res.cloudinary.com/TU-CUENTA/image/upload/v1234567890/crokete/logo-footer.svg"

// Ejemplo - Slider
"first_img": "https://res.cloudinary.com/TU-CUENTA/image/upload/v1234567890/crokete/slider-1.jpg"
```

### 5. Sincroniza a la base de datos

```bash
cd crokete-backend
node scripts/update-settings-to-db.js
```

## Opción 3: Usar URLs Directas (Temporal)

Si tienes las imágenes en otro servidor o servicio:

1. Sube tus imágenes a cualquier hosting (Imgur, PostImg, etc.)
2. Obtén las URLs públicas
3. Actualiza `settings.js` con esas URLs
4. Ejecuta `node scripts/update-settings-to-db.js`

## Imágenes Recomendadas y Sus Dimensiones

### Logos
- **Logo Navbar**: 180x50px, formato SVG o PNG transparente
- **Logo Footer**: 200x60px, formato SVG o PNG
- **Favicon**: 32x32px o 64x64px, formato .ico o .png

### Sliders del Home
- **Dimensiones**: 1920x600px (desktop) / 800x400px (mobile)
- **Formato**: JPG o WebP
- **Peso**: < 200KB por imagen
- **Cantidad**: 3-5 sliders

### Imágenes del Equipo (About Us)
- **Dimensiones**: 300x300px
- **Formato**: JPG o WebP
- **Peso**: < 100KB por imagen
- **Cantidad**: 6 fotos

### Banners y Headers
- **Header pages**: 1920x300px
- **Banner entrega**: 800x600px
- **Métodos de pago**: 400x60px

### SEO
- **Meta Image (Open Graph)**: 1200x630px, JPG
- **Favicon**: 32x32px, .ico o .png

## Crear un Logo Temporal

Si no tienes logo todavía, puedes:

### Opción A: Usar un generador online
- https://www.canva.com/
- https://www.freelogodesign.org/
- https://www.renderforest.com/logo-maker

### Opción B: Usar texto simple
Crea un SVG simple con texto:

```svg
<svg width="180" height="50" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="35" font-family="Arial" font-size="30" font-weight="bold" fill="#2563eb">
    CROKETE
  </text>
  <text x="10" y="48" font-family="Arial" font-size="10" fill="#666">
    Pet Store
  </text>
</svg>
```

Guarda esto como `logo.svg` y súbelo a Cloudinary o a tu servidor.

## Verificar los Cambios

### 1. Reinicia el frontend
```bash
cd crokete-store
npm run dev
```

### 2. Limpia la caché del navegador
- Chrome/Edge: Ctrl + Shift + Delete
- Firefox: Ctrl + Shift + Delete
- Safari: Cmd + Option + E

### 3. Recarga la página
Deberías ver tus nuevas imágenes sin errores 404.

## Scripts Útiles

```bash
# Ver todas las imágenes configuradas y su estado
node scripts/check-image-urls.js

# Actualizar todas las configuraciones desde settings.js
node scripts/update-settings-to-db.js

# Deshabilitar Stripe temporalmente (si causa problemas)
node scripts/disable-stripe.js

# Configurar Stripe correctamente
node scripts/fix-stripe-config.js
```

## Solución de Problemas

### Las imágenes no se cargan después de actualizar

1. Verifica que ejecutaste `update-settings-to-db.js`
2. Reinicia el backend: `npm run dev` en `crokete-backend`
3. Reinicia el frontend: `npm run dev` en `crokete-store`
4. Limpia la caché del navegador

### Error 404 en las imágenes

Las URLs de Cloudinary antiguas ya no existen. Debes:
1. Subir tus propias imágenes
2. O usar el panel de administración para configurarlas
3. O temporalmente eliminar las URLs dejándolas vacías (`""`)

### La base de datos no se actualiza

Verifica:
1. Que el archivo `.env` tenga la variable `MONGO_URI` correcta
2. Que MongoDB esté corriendo
3. Que no haya errores de sintaxis en `settings.js`

## Próximos Pasos

1. ✅ Logos deshabilitados temporalmente (sin errores 404)
2. ✅ Stripe deshabilitado temporalmente
3. ⏳ **Pendiente**: Subir logos de Crokete
4. ⏳ **Pendiente**: Subir imágenes de sliders
5. ⏳ **Pendiente**: Configurar imágenes del equipo
6. ⏳ **Pendiente**: Configurar favicon

## Recursos Adicionales

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Image Optimization Guide](https://web.dev/fast/#optimize-your-images)
- [SVG vs PNG for Logos](https://www.adobe.com/creativecloud/file-types/image/comparison/svg-vs-png.html)
