# 🔒 Guía de Seguridad del Sistema Crokete

## Fecha de Implementación
7 de Febrero, 2026

## Resumen Ejecutivo

Este documento describe las medidas de seguridad implementadas en el sistema de administración de Crokete para proteger el acceso no autorizado y garantizar la integridad de los datos.

---

## 1. Sistema de Bootstrap (Primer Super Admin)

### Crear el Primer Super Admin

Para inicializar el sistema con el primer super admin, sigue estos pasos:

#### Paso 1: Configurar Variables de Entorno

Edita el archivo `.env` en `crokete-backend` y configura las siguientes variables:

```env
SUPER_ADMIN_EMAIL=tu_email@crokete.com.mx
SUPER_ADMIN_PASSWORD=ContraseñaSegura123!
SUPER_ADMIN_NAME=Tu Nombre Completo
```

**⚠️ IMPORTANTE:**
- Usa una contraseña fuerte (mínimo 12 caracteres, letras, números y símbolos)
- No compartas estas credenciales
- **Después del primer login, cambia la contraseña desde el panel de administración**

#### Paso 2: Ejecutar el Script de Inicialización

Desde la carpeta `crokete-backend`, ejecuta:

```bash
npm run init:admin
```

Este script:
- Verifica que no exista ya un super admin
- Crea el primer super admin con las credenciales del .env
- Asigna todos los permisos necesarios

#### Paso 3: Eliminar Credenciales del .env

**Por seguridad, después de crear el super admin inicial:**
1. Comenta o elimina las variables `SUPER_ADMIN_*` del archivo `.env`
2. O cámbialas a valores diferentes

---

## 2. Control de Acceso y Roles

### Jerarquía de Roles

El sistema implementa los siguientes roles:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **super admin** | Administrador principal | Acceso total, gestión de staff |
| **manager** | Gerente | Gestión de productos, órdenes, clientes |
| **admin** | Administrador | Operaciones básicas del sistema |
| **cashier** | Cajero | Gestión de órdenes y ventas |
| **accountant** | Contador | Reportes financieros |
| Otros | Roles personalizados | Según `access_list` |

### Reglas de Seguridad

1. **Solo Super Admins pueden:**
   - Crear nuevos administradores
   - Editar roles de otros usuarios
   - Eliminar administradores
   - Cambiar el estado (activo/inactivo) de otros admins
   - Ver logs de auditoría

2. **Protecciones del Sistema:**
   - No se puede eliminar el último super admin
   - No se puede desactivar el último super admin activo
   - Los admins normales solo pueden editar su propio perfil
   - No se puede auto-asignar un rol superior

3. **Access List (Lista de Acceso):**
   - Cada admin tiene una `access_list` que define a qué secciones puede acceder
   - Mínimo requerido: `['dashboard', 'edit-profile']`

---

## 3. Autenticación y Rate Limiting

### Rate Limiting de Login

**Configuración:**
- Máximo **5 intentos fallidos** de login
- Bloqueo temporal de **30 minutos** después del 5to intento
- El bloqueo se aplica por **email + IP**

**Funcionamiento:**
1. Cada intento fallido incrementa el contador
2. Al llegar a 5 intentos, la cuenta se bloquea temporalmente
3. Después de un login exitoso, el contador se resetea
4. Los registros antiguos se eliminan automáticamente después de 24 horas

**Mensaje de bloqueo:**
```
Too many failed login attempts. Account blocked for 30 minutes.
```

### Tokens JWT

- **Lifetime:** 1 día (24 horas)
- **Refresh:** Implementado con `JWT_REFRESH_SECRET`
- Los tokens incluyen: `_id`, `name`, `email`, `address`, `phone`, `image`

---

## 4. Sistema de Auditoría

### Acciones Registradas

El sistema registra las siguientes acciones en la colección `auditlogs`:

| Acción | Descripción |
|--------|-------------|
| `LOGIN_SUCCESS` | Login exitoso |
| `LOGIN_FAILED` | Intento de login fallido |
| `CREATE_ADMIN` | Creación de nuevo administrador |
| `UPDATE_ADMIN` | Actualización de datos de admin |
| `UPDATE_ROLE` | Cambio de rol de admin |
| `UPDATE_STATUS` | Cambio de estado (activo/inactivo) |
| `DELETE_ADMIN` | Eliminación de administrador |
| `UPDATE_PROFILE` | Admin actualiza su propio perfil |
| `PASSWORD_CHANGE` | Cambio de contraseña |

### Datos Registrados

Cada log incluye:
- **Admin que ejecuta la acción:** ID, email, nombre
- **Target (objetivo):** Admin afectado (si aplica)
- **Cambios realizados:** Objeto JSON con old/new values
- **IP y User Agent:** Información del navegador
- **Timestamp:** Fecha y hora exacta
- **Status:** success o failure

### Consultar Logs de Auditoría

**Endpoints disponibles (solo para Super Admins):**

```bash
# Listar todos los logs (con paginación y filtros)
GET /v1/audit?page=1&limit=50&action=CREATE_ADMIN&startDate=2026-01-01

# Logs de un admin específico
GET /v1/audit/:adminId

# Estadísticas de auditoría
GET /v1/audit/stats?days=30
```

**Parámetros de filtro:**
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 50)
- `action`: Filtrar por tipo de acción
- `adminId`: Filtrar por admin que ejecutó la acción
- `targetId`: Filtrar por admin afectado
- `startDate`: Fecha inicio (YYYY-MM-DD)
- `endDate`: Fecha fin (YYYY-MM-DD)

---

## 5. Endpoints Protegidos

### Rutas Públicas (sin autenticación)

```
POST /v1/admin/login                    # Login
PUT  /v1/admin/forget-password          # Solicitar reset de contraseña
PUT  /v1/admin/reset-password           # Cambiar contraseña con token
```

### Rutas Protegidas (requieren autenticación)

```
GET  /v1/admin/me                       # Ver propio perfil
PUT  /v1/admin/me                       # Actualizar propio perfil
```

### Rutas Protegidas (Solo Super Admin)

```
POST   /v1/admin/add                    # Crear nuevo admin
GET    /v1/admin                        # Listar todos los admins
GET    /v1/admin/:id                    # Ver detalle de admin
PUT    /v1/admin/:id                    # Actualizar admin
PUT    /v1/admin/update-status/:id      # Cambiar estado
DELETE /v1/admin/:id                    # Eliminar admin

GET    /v1/audit                        # Logs de auditoría
GET    /v1/audit/stats                  # Estadísticas
GET    /v1/audit/:adminId               # Logs de admin específico
```

---

## 6. Mejores Prácticas de Seguridad

### Para Super Admins

1. **Contraseñas Fuertes:**
   - Mínimo 12 caracteres
   - Combinar mayúsculas, minúsculas, números y símbolos
   - No usar palabras comunes o información personal
   - Cambiar contraseña periódicamente (cada 3-6 meses)

2. **Gestión de Staff:**
   - Asignar solo los permisos necesarios
   - Revisar periódicamente los usuarios activos
   - Desactivar cuentas de empleados que ya no trabajan
   - No compartir credenciales de super admin

3. **Monitoreo:**
   - Revisar logs de auditoría regularmente
   - Investigar intentos de login fallidos sospechosos
   - Verificar acciones no autorizadas

### Para Todos los Admins

1. **Seguridad de Cuenta:**
   - No compartir contraseñas
   - Cerrar sesión al terminar
   - No usar el sistema desde computadoras públicas
   - Reportar actividad sospechosa

2. **Datos Sensibles:**
   - No copiar/pegar credenciales en chats o emails
   - No dejar la sesión abierta sin supervisión
   - Verificar que la URL sea la correcta antes de hacer login

---

## 7. Variables de Entorno Requeridas

### Backend (.env)

```env
# MongoDB
MONGO_URI=mongodb+srv://...

# JWT Tokens
JWT_SECRET=<long_random_string>
JWT_REFRESH_SECRET=<another_long_random_string>
JWT_SECRET_FOR_VERIFY=<third_long_random_string>

# Encryption
ENCRYPT_PASSWORD=<32_digit_hex_key>

# URLs
ADMIN_URL=http://localhost:4100     # URL del panel de admin
STORE_URL=http://localhost:3000     # URL de la tienda

# Bootstrap (solo para primera vez)
SUPER_ADMIN_EMAIL=admin@crokete.com.mx
SUPER_ADMIN_PASSWORD=YourSecurePassword
SUPER_ADMIN_NAME=Administrator Name
```

---

## 8. Resolución de Problemas

### "Too many failed login attempts"

**Problema:** La cuenta está bloqueada temporalmente

**Solución:**
1. Esperar 30 minutos
2. O eliminar el registro manualmente de la base de datos:
   ```javascript
   db.loginattempts.deleteOne({ email: "email@example.com" })
   ```

### "Access denied. Super Admin privileges required"

**Problema:** Intentas acceder a una función de solo super admin

**Solución:**
- Contacta a un super admin para que te asigne los permisos necesarios
- O pide que realicen la acción por ti

### No puedo eliminar/desactivar un super admin

**Problema:** Sistema previene eliminar el último super admin

**Solución:**
- Crea otro super admin primero
- Luego podrás eliminar/desactivar el anterior

### Olvidé la contraseña del super admin

**Solución rápida:**
1. Accede a MongoDB directamente
2. Crea un nuevo super admin con el script de bootstrap
3. O resetea la contraseña manually en la BD

---

## 9. Arquitectura de Seguridad

### Flujo de Autenticación

```
1. Usuario → POST /v1/admin/login (email, password)
2. Sistema verifica rate limit (LoginAttempt)
3. Sistema busca admin en BD
4. Sistema verifica password (bcrypt)
5. Sistema verifica status === "active"
6. Sistema genera JWT token
7. Sistema registra LOGIN_SUCCESS en AuditLog
8. Sistema resetea intentos fallidos
9. Retorna token + datos del admin
```

### Flujo de Autorización

```
1. Request → Header: Authorization: Bearer <token>
2. Middleware isAuth verifica y decodifica token
3. req.user = decoded token data
4. Si ruta requiere super admin:
   → Middleware isSuperAdmin verifica role === "super admin"
5. Controller ejecuta lógica
6. Sistema registra acción en AuditLog
7. Retorna respuesta
```

---

## 10. Checklist de Seguridad

### Al Desplegar a Producción

- [ ] Cambiar todas las variables JWT_SECRET por valores únicos y aleatorios
- [ ] Usar contraseñas fuertes para todos los super admins
- [ ] Eliminar credenciales de super admin del .env
- [ ] Configurar HTTPS en el dominio
- [ ] Configurar CORS correctamente (solo dominios permitidos)
- [ ] Habilitar rate limiting en el servidor web (Nginx/Apache)
- [ ] Configurar backups automáticos de la base de datos
- [ ] Configurar alertas para intentos de login fallidos
- [ ] Revisar permisos de usuarios existentes
- [ ] Documentar credenciales de super admin en lugar seguro

### Mantenimiento Regular

- [ ] Revisar logs de auditoría semanalmente
- [ ] Cambiar contraseñas de super admins cada 3-6 meses
- [ ] Revisar y eliminar cuentas inactivas
- [ ] Actualizar dependencias de seguridad (npm audit)
- [ ] Verificar backups funcionando correctamente
- [ ] Monitorear intentos de acceso sospechosos

---

## 11. Contacto de Seguridad

Si descubres una vulnerabilidad de seguridad, por favor reporta de inmediato a:

**Email de Seguridad:** [security@crokete.com.mx]
**Super Admin Principal:** [Definir contacto]

---

## 12. Historial de Cambios

### Versión 1.0 (7 Febrero 2026)
- ✅ Implementación de sistema de bootstrap
- ✅ Control de acceso basado en roles
- ✅ Rate limiting en login (5 intentos / 30 min)
- ✅ Sistema de auditoría completo
- ✅ Protección de endpoints críticos
- ✅ Eliminación de registro público
- ✅ Prevención de escalación de privilegios
- ✅ Middleware isSuperAdmin
- ✅ Endpoints /admin/me para autogestión

---

## Apéndice A: Comandos Útiles

```bash
# Crear super admin inicial
npm run init:admin

# Ver logs de aplicación
npm run dev

# Limpiar intentos de login de un email específico (MongoDB)
db.loginattempts.deleteMany({ email: "email@example.com" })

# Ver todos los super admins (MongoDB)
db.admins.find({ role: "super admin" })

# Contar intentos fallidos de login (MongoDB)
db.loginattempts.countDocuments()

# Ver logs de auditoría recientes (MongoDB)
db.auditlogs.find().sort({ createdAt: -1 }).limit(10)
```

---

**Documento generado:** 7 de Febrero, 2026  
**Versión:** 1.0  
**Autor:** Sistema de Seguridad Crokete
