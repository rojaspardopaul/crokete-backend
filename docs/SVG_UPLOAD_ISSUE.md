# Solución: Mantener archivos SVG sin conversión a PNG

## El Problema

Los archivos SVG se están convirtiendo automáticamente a PNG cuando se suben a través del admin panel. Esto sucede porque el **upload preset de Cloudinary** tiene configurada una transformación automática.

## La Causa

El código de `Uploader.jsx` (líneas 41-44) está correctamente configurado:

```javascript
// If file is SVG, return it without resizing
if (file.type === "image/svg+xml") {
  return Promise.resolve(file);
}
```

El problema está en la configuración del **Upload Preset** en Cloudinary.

## Cómo Solucionarlo

### Opción 1: Configurar el Upload Preset en Cloudinary (RECOMENDADO)

1. **Accede a tu dashboard de Cloudinary:**
   - Ve a: https://cloudinary.com/console
   - Inicia sesión con tu cuenta

2. **Ve a Settings > Upload:**
   - En el menú lateral, haz clic en el icono de engranaje (Settings)
   - Selecciona "Upload" en el menú

3. **Edita tu Upload Preset:**
   - Busca tu upload preset (el que está configurado en `.env` como `VITE_APP_CLOUDINARY_UPLOAD_PRESET`)
   - Haz clic en "Edit" junto a ese preset

4. **Configura para preservar formato original:**
   - En la sección "Format settings":
     - **Format**: Deja en "Auto" o "Original"
     - **Allowed formats**: Asegúrate que incluya "svg"
   - En la sección "Transformations":
     - Busca cualquier transformación de formato (como `f_png`, `f_jpg`, etc.)
     - **ELIMINA** o cambia a `f_auto` (formato automático)
   - En "Upload Manipulations":
     - Verifica que NO haya una transformación que fuerce PNG

5. **Guarda los cambios:**
   - Haz clic en "Save" en la parte superior

### Opción 2: Modificar el Código para Forzar Formato SVG

Si no puedes modificar el upload preset, puedes cambiar el código:

**En `crokete-admin/src/components/image-uploader/Uploader.jsx`:**

Encuentra este bloque (alrededor de la línea 150-170):

```javascript
const formData = new FormData();
formData.append("file", file);
formData.append(
  "upload_preset",
  import.meta.env.VITE_APP_CLOUDINARY_UPLOAD_PRESET
);
formData.append("cloud_name", import.meta.env.VITE_APP_CLOUD_NAME);
formData.append("folder", folder);
formData.append("public_id", public_id);
```

**Agrega esta línea después:**

```javascript
// Preserve format for SVG files
if (file.type === "image/svg+xml") {
  formData.append("format", "svg");
  formData.append("resource_type", "image");
}
```

El código completo quedaría así:

```javascript
const formData = new FormData();
formData.append("file", file);
formData.append(
  "upload_preset",
  import.meta.env.VITE_APP_CLOUDINARY_UPLOAD_PRESET
);
formData.append("cloud_name", import.meta.env.VITE_APP_CLOUD_NAME);
formData.append("folder", folder);
formData.append("public_id", public_id);

// Preserve format for SVG files
if (file.type === "image/svg+xml") {
  formData.append("format", "svg");
  formData.append("resource_type", "image");
}
```

### Opción 3: Crear un Upload Preset Específico para SVG

1. **Crea un nuevo upload preset en Cloudinary:**
   - Ve a Settings > Upload > Add upload preset
   - Nombre: `crokete_svg_preset` (o el nombre que prefieras)

2. **Configúralo para SVG:**
   - Signing mode: "Unsigned"
   - Folder: `crokete` (o el folder que uses)
   - Format: "Original"
   - Allowed formats: Marca solo "svg"
   - Transformations: Ninguna

3. **Guarda el preset**

4. **Modifica el código para usar este preset solo para SVG:**

```javascript
// En Uploader.jsx, línea ~150
const uploadPreset = file.type === "image/svg+xml" 
  ? "crokete_svg_preset"  // Preset específico para SVG
  : import.meta.env.VITE_APP_CLOUDINARY_UPLOAD_PRESET; // Preset normal para otras imágenes

formData.append("upload_preset", uploadPreset);
```

## Verificar la Configuración Actual

### 1. Revisa tu archivo `.env` del admin:

```bash
cd crokete-admin
cat .env  # En Windows: type .env
```

Busca estas variables:
```env
VITE_APP_CLOUD_NAME=tu_cloud_name
VITE_APP_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset
```

### 2. Verifica el upload preset en Cloudinary:

- Ve a tu dashboard de Cloudinary
- Settings > Upload
- Busca el preset que estás usando
- Verifica que no tenga transformaciones de formato

## Cómo Probar

1. **Después de aplicar la solución:**
   ```bash
   cd crokete-admin
   npm run dev
   ```

2. **Sube un archivo SVG:**
   - Ve a Settings > Store Customization
   - Sube un logo en formato SVG
   - Inspecciona la URL resultante

3. **La URL debería terminar en `.svg`:**
   ```
   ✅ CORRECTO: https://res.cloudinary.com/tu-cuenta/image/upload/v1234567890/crokete/logo.svg
   ❌ INCORRECTO: https://res.cloudinary.com/tu-cuenta/image/upload/v1234567890/crokete/logo.png
   ```

## Ventajas de Mantener SVG

1. **Escalabilidad infinita** - Los SVG se ven perfectos en cualquier tamaño
2. **Menor peso** - Los SVG suelen ser más pequeños que PNG
3. **Editable** - Puedes cambiar colores y formas con CSS
4. **Mejor para logos** - Ideal para logos, iconos, y gráficos vectoriales

## Troubleshooting

### El SVG sigue convirtiéndose a PNG

1. Verifica que hayas guardado los cambios en Cloudinary
2. Limpia la caché de Cloudinary (puede tomar unos minutos)
3. Prueba subiendo el archivo con un nombre diferente
4. Verifica que el archivo realmente sea SVG (abre con un editor de texto, debería empezar con `<svg>`)

### Los SVG no se muestran correctamente

Algunos SVG pueden tener problemas si:
- Tienen referencias externas (como fuentes web)
- Usan scripts o animaciones complejas
- Tienen dimensiones no definidas

**Solución**: Asegúrate que tu SVG tenga atributos `width` y `height` o `viewBox` definidos.

### Error al subir SVG

Si recibes un error al intentar subir SVG:
1. Verifica que tu plan de Cloudinary permita SVG (todos los planes gratuitos lo permiten)
2. Asegúrate que el SVG no esté corrupto
3. Verifica que el tamaño del archivo sea menor a 5MB

## Configuración Recomendada para Cloudinary

```yaml
Upload Preset Configuration:
  name: crokete_main
  signing_mode: unsigned
  folder: crokete
  
  Format Settings:
    format: auto (preserva el formato original)
    allowed_formats: [jpg, png, webp, svg]
  
  Transformations:
    - NINGUNA transformación de formato forzada
    - Permitir que el formato original se preserve
  
  Advanced:
    resource_type: auto
    use_filename: true
    unique_filename: true
```

## Recursos Adicionales

- [Cloudinary SVG Documentation](https://cloudinary.com/documentation/image_transformations#svg_format)
- [Upload Preset Configuration](https://cloudinary.com/documentation/upload_presets)
- [SVG Best Practices](https://www.smashingmagazine.com/2021/03/svg-generators/)
