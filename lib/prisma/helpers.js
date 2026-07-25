/**
 * Utilidades compartidas por los controladores portados a Prisma.
 *
 * Recogen los patrones que Mongoose resolvía implícitamente y que en Postgres
 * hay que manejar de forma explícita: identificadores mal formados, campos
 * "actualiza sólo lo que venga" y borrados masivos.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres rechaza un uuid mal formado con un error de tipo (500). Mongoose
 * simplemente no encontraba nada, así que se valida antes para poder responder
 * 404 igual que antes.
 */
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Filtra una lista de ids quedándose sólo con los uuid válidos. */
function uuidList(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter(isUuid);
}

/**
 * Réplica del patrón `updateMany` del panel: aplicar sólo las claves que
 * realmente vienen en el body, ignorando vacíos y la propia lista de ids.
 */
function pickDefined(body, allowedKeys) {
  const data = {};
  for (const key of allowedKeys) {
    const value = body[key];
    if (value === undefined || value === null || value === "" || value === "[]") continue;
    data[key] = value;
  }
  return data;
}

/** Respuesta de error homogénea (los mensajes de usuario van en español). */
function fail(res, err, status = 500) {
  return res.status(status).send({ message: err?.message || String(err) });
}

/** 404 con el mensaje que ya devolvía la API. */
function notFound(res, message = "No encontrado.") {
  return res.status(404).send({ message });
}

module.exports = { isUuid, uuidList, pickDefined, fail, notFound };
