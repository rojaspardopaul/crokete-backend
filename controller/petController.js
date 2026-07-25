const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");

const prisma = () => getPrisma().pet;

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.icon !== undefined) row.icon = body.icon;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

const addPet = async (req, res) => {
  try {
    await prisma().create({ data: toRow(req.body) });
    res.status(200).send({ message: "Mascota agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllPets = async (req, res) => {
  try {
    await prisma().deleteMany();
    await prisma().createMany({ data: (req.body || []).map(toRow) });
    res.status(200).send({ message: "Mascotas agregadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllPets = async (req, res) => {
  try {
    const rows = await prisma().findMany({ orderBy: { createdAt: "desc" } });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingPets = async (req, res) => {
  try {
    const rows = await prisma().findMany({
      where: { status: "show" },
      orderBy: { name: "asc" },
    });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getPetById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Mascota no encontrada.");
    const row = await prisma().findUnique({ where: { id: req.params.id } });
    if (!row) return notFound(res, "Mascota no encontrada.");
    res.send(toApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updatePet = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Mascota no encontrada.");
    const current = await prisma().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Mascota no encontrada.");

    const data = toRow(req.body);
    // Igual que en marcas: el panel puede mandar sólo un idioma.
    if (req.body.name !== undefined) {
      data.name = { ...(current.name || {}), ...(req.body.name || {}) };
    }

    await prisma().update({ where: { id: req.params.id }, data });
    res.send({ message: "Mascota actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Mascota no encontrada.");
    const status = req.body.status;
    await prisma().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Mascota ${status === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deletePet = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Mascota no encontrada.");
    await prisma().delete({ where: { id: req.params.id } });
    res.status(200).send({ message: "Mascota eliminada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyPets = async (req, res) => {
  try {
    await prisma().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    res.status(200).send({ message: "Mascotas eliminadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyPets = async (req, res) => {
  try {
    const data = toRow(req.body);
    await prisma().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    res.send({ message: "Mascotas actualizadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addPet,
  addAllPets,
  getAllPets,
  getShowingPets,
  getPetById,
  updatePet,
  updateStatus,
  deletePet,
  deleteManyPets,
  updateManyPets,
};
