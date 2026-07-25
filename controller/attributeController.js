const { getPrisma } = require("../lib/prisma");
const { attributeToApi, toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");
const { handleProductAttribute } = require("../lib/stock-controller/others");

const attributes = () => getPrisma().attribute;
const values = () => getPrisma().attributeValue;

/** Los valores del atributo viajan como `variants` en la API heredada. */
const WITH_VALUES = { values: { orderBy: { createdAt: "asc" } } };

function toRow(body) {
  const row = {};
  if (body.title !== undefined) row.title = body.title;
  if (body.name !== undefined) row.name = body.name;
  if (body.option !== undefined) row.option = body.option;
  if (body.type !== undefined) row.type = body.type;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

const addAttribute = async (req, res) => {
  try {
    const { variants = [], ...rest } = req.body;
    await attributes().create({
      data: {
        ...toRow(rest),
        values: {
          create: variants.map((v) => ({ name: v.name, status: v.status || "show" })),
        },
      },
    });
    res.send({ message: "¡Atributo agregado correctamente!" });
  } catch (err) {
    res.status(500).send({ message: `Error al agregar el atributo: ${err.message}` });
  }
};

const addChildAttributes = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Atributo no encontrado.");
    await values().create({
      data: {
        attributeId: req.params.id,
        name: req.body.name,
        status: req.body.status || "show",
      },
    });
    res.send({ message: "¡Valor de atributo agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllAttributes = async (req, res) => {
  try {
    await attributes().deleteMany();
    for (const item of req.body || []) {
      const { variants = [], ...rest } = item;
      await attributes().create({
        data: {
          ...toRow(rest),
          values: { create: variants.map((v) => ({ name: v.name, status: v.status || "show" })) },
        },
      });
    }
    res.send({ message: "¡Atributos agregados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllAttributes = async (req, res) => {
  try {
    const { type, option, option1 } = req.query;
    // Se replica el $or heredado: por tipo, o por cualquiera de las dos opciones.
    const or = [];
    if (type) or.push({ type });
    if (option) or.push({ option });
    if (option1) or.push({ option: option1 });

    const rows = await attributes().findMany({
      where: or.length ? { OR: or } : {},
      include: WITH_VALUES,
    });
    res.send(rows.map(attributeToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingAttributes = async (req, res) => {
  try {
    // Equivale a la agregación anterior ($match + $filter): atributos visibles
    // con al menos un valor visible, devolviendo sólo esos valores.
    const rows = await attributes().findMany({
      where: { status: "show", values: { some: { status: "show" } } },
      include: { values: { where: { status: "show" }, orderBy: { createdAt: "asc" } } },
    });
    res.send(rows.map(attributeToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingAttributesTest = async (req, res) => {
  try {
    const rows = await attributes().findMany({ where: { status: "show" }, include: WITH_VALUES });
    res.send(rows.map(attributeToApi));
  } catch (err) {
    fail(res, err);
  }
};

const updateManyAttribute = async (req, res) => {
  try {
    const data = {};
    if (req.body.option !== undefined) data.option = req.body.option;
    if (req.body.status !== undefined) data.status = req.body.status;
    await attributes().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    res.send({ message: "¡Atributos actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAttributeById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Atributo no encontrado.");
    const row = await attributes().findUnique({
      where: { id: req.params.id },
      include: WITH_VALUES,
    });
    if (!row) return notFound(res, "Atributo no encontrado.");
    res.send(attributeToApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const getChildAttributeById = async (req, res) => {
  try {
    const { ids } = req.params;
    if (!isUuid(ids)) return notFound(res, "Valor de atributo no encontrado.");
    const row = await values().findUnique({ where: { id: ids } });
    if (!row) return notFound(res, "Valor de atributo no encontrado.");
    res.send(toApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateAttributes = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Atributo no encontrado.");
    const current = await attributes().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Atributo no encontrado.");

    const data = toRow(req.body);
    if (req.body.title !== undefined) {
      data.title = { ...(current.title || {}), ...(req.body.title || {}) };
    }
    if (req.body.name !== undefined) {
      data.name = { ...(current.name || {}), ...(req.body.name || {}) };
    }

    await attributes().update({ where: { id: req.params.id }, data });
    res.send({ message: "¡Atributo actualizado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateChildAttributes = async (req, res) => {
  try {
    const { childId } = req.params;
    if (!isUuid(childId)) return notFound(res, "Valor de atributo no encontrado.");

    const current = await values().findUnique({ where: { id: childId } });
    if (!current) return notFound(res, "Valor de atributo no encontrado.");

    await values().update({
      where: { id: childId },
      data: {
        name: { ...(current.name || {}), ...(req.body.name || {}) },
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
      },
    });
    res.send({ message: "¡Valor de atributo actualizado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyChildAttribute = async (req, res) => {
  try {
    const ids = uuidList(req.body.ids);
    if (ids.length === 0) {
      return res.send({ message: "¡Valores de atributo actualizados correctamente!" });
    }

    // Con los valores en su propia tabla, "mover a otro atributo" es reasignar
    // la clave foránea; antes había que copiar el subdocumento y hacer $pull.
    const data = {};
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.changeId && isUuid(req.body.changeId)) data.attributeId = req.body.changeId;

    await values().updateMany({ where: { id: { in: ids } }, data });
    res.send({ message: "¡Valores de atributo actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Atributo no encontrado.");
    const status = req.body.status;
    await attributes().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Atributo ${status === "show" ? "publicado" : "ocultado"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const updateChildStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Valor de atributo no encontrado.");
    const status = req.body.status;
    await values().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Valor de atributo ${status === "show" ? "publicado" : "ocultado"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteAttribute = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Atributo no encontrado.");
    // Los valores caen por ON DELETE CASCADE.
    await attributes().delete({ where: { id: req.params.id } });
    res.send({ message: "¡Atributo eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteChildAttribute = async (req, res) => {
  try {
    const { attributeId, childId } = req.params;
    if (!isUuid(childId)) return notFound(res, "Valor de atributo no encontrado.");

    await values().delete({ where: { id: childId } });
    await handleProductAttribute(attributeId, childId);
    res.send({ message: "¡Valor de atributo eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyAttribute = async (req, res) => {
  try {
    await attributes().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    res.send({ message: "¡Atributos eliminados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyChildAttribute = async (req, res) => {
  try {
    const ids = uuidList(req.body.ids);
    await values().deleteMany({ where: { id: { in: ids } } });
    await handleProductAttribute(req.body.id, ids, "multi");
    res.send({ message: "¡Valores de atributo eliminados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addAttribute,
  addAllAttributes,
  getAllAttributes,
  getShowingAttributes,
  getAttributeById,
  updateAttributes,
  updateStatus,
  updateChildStatus,
  deleteAttribute,
  getShowingAttributesTest,
  deleteChildAttribute,
  addChildAttributes,
  updateChildAttributes,
  getChildAttributeById,
  updateManyAttribute,
  deleteManyAttribute,
  updateManyChildAttribute,
  deleteManyChildAttribute,
};
