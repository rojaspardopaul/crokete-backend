const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");

const prisma = () => getPrisma().language;

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.code !== undefined) row.code = String(body.code).toLowerCase();
  if (body.flag !== undefined) row.flag = body.flag;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

const addLanguage = async (req, res) => {
  try {
    const code = String(req.body.code || "").toLowerCase();
    // `code` es único en la base; se comprueba antes para conservar el 400
    // con mensaje propio en vez de un error de restricción.
    const exist = await prisma().findUnique({ where: { code } });
    if (exist) {
      return res.status(400).send({ message: "¡El idioma ya existe!" });
    }
    await prisma().create({ data: toRow(req.body) });
    res.send({ message: "¡Idioma agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllLanguage = async (req, res) => {
  try {
    await prisma().createMany({ data: (req.body || []).map(toRow), skipDuplicates: true });
    res.send({ message: "¡Zonas agregadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllLanguages = async (req, res) => {
  try {
    res.send((await prisma().findMany()).map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingLanguage = async (req, res) => {
  try {
    const rows = await prisma().findMany({
      where: { status: "show" },
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getLanguageById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Idioma no encontrado.");
    const row = await prisma().findUnique({ where: { id: req.params.id } });
    if (!row) return notFound(res, "Idioma no encontrado.");
    res.send(toApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateLanguage = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Idioma no encontrado.");
    await prisma().update({ where: { id: req.params.id }, data: toRow(req.body) });
    res.send({ message: "¡Idioma actualizado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyLanguage = async (req, res) => {
  try {
    await prisma().updateMany({
      where: { id: { in: uuidList(req.body.ids) } },
      data: { status: req.body.status },
    });
    res.send({ message: "¡Idiomas actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Idioma no encontrado.");
    const status = req.body.status;
    await prisma().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Idioma ${status === "show" ? "publicado" : "ocultado"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteLanguage = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Idioma no encontrado.");
    await prisma().delete({ where: { id: req.params.id } });
    res.send({ message: "¡Idioma eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyLanguage = async (req, res) => {
  try {
    await prisma().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    res.send({ message: "¡Idioma eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addLanguage,
  addAllLanguage,
  getAllLanguages,
  getShowingLanguage,
  getLanguageById,
  updateLanguage,
  updateStatus,
  deleteLanguage,
  updateManyLanguage,
  deleteManyLanguage,
};
