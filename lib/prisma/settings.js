/**
 * Acceso a la tabla `settings` (configuración editable desde el panel).
 *
 * Vive aquí y no en el controlador porque media docena de módulos —pedidos,
 * correo, notificaciones, credenciales— leen la misma configuración, y la
 * escritura tiene que ser un merge atómico en todos los casos.
 */
const { getPrisma } = require("./index");

/** Devuelve el objeto `setting` de una configuración con nombre dado. */
async function readSetting(name) {
  const row = await getPrisma().setting.findUnique({ where: { name } });
  return row ? row.setting : null;
}

/**
 * Fusiona claves de primer nivel dentro del jsonb, creando la fila si no
 * existe. El operador `||` de jsonb hace exactamente el mismo merge superficial
 * que `$set: { "setting.<clave>": valor }` en Mongo, pero en una sola sentencia
 * atómica: no hay lectura-modificación-escritura que se pueda perder si dos
 * pestañas del panel guardan a la vez.
 */
async function mergeSetting(name, patch) {
  const rows = await getPrisma().$queryRaw`
    INSERT INTO settings (id, name, setting, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${name}, ${JSON.stringify(patch || {})}::jsonb, now(), now())
    ON CONFLICT (name) DO UPDATE
      SET setting = settings.setting || EXCLUDED.setting,
          "updatedAt" = now()
    RETURNING *`;
  return rows[0];
}

module.exports = { readSetting, mergeSetting };
