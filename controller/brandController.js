const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");
const { invalidateBrands, invalidateAll } = require("../lib/cache/invalidation");
const { findDescendantCategoryIds } = require("../utils/categoryHierarchy");

const prisma = () => getPrisma();
const brands = () => getPrisma().brand;

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.image !== undefined) row.image = body.image;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

const addBrand = async (req, res) => {
  try {
    await brands().create({ data: toRow(req.body) });
    invalidateBrands();
    res.status(200).send({ message: "Marca agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllBrands = async (req, res) => {
  try {
    await brands().deleteMany();
    await brands().createMany({ data: (req.body || []).map(toRow) });
    invalidateAll();
    res.status(200).send({ message: "Marcas agregadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllBrands = async (req, res) => {
  try {
    const rows = await brands().findMany({ orderBy: { createdAt: "desc" } });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingBrands = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      const rows = await brands().findMany({
        where: { status: "show" },
        orderBy: { name: "asc" },
      });
      return res.send(rows.map(toApi));
    }

    if (!isUuid(String(category))) return res.send([]);

    // El árbol de categorías se recorre en memoria (son pocas y ya venían
    // cacheadas); findDescendantCategoryIds sólo necesita _id/parentId.
    const cats = await prisma().category.findMany({
      where: { status: "show" },
      select: { id: true, parentId: true },
    });
    const relatedIds = findDescendantCategoryIds(
      cats.map((c) => ({ _id: c.id, parentId: c.parentId })),
      category
    );
    if (relatedIds.length === 0) return res.send([]);

    // Marca presente en algún producto visible de esas categorías, ya sea por
    // la categoría principal o por la relación N:M.
    const withBrand = await prisma().product.findMany({
      where: {
        brandId: { not: null },
        status: "show",
        OR: [
          { categoryId: { in: relatedIds } },
          { categories: { some: { categoryId: { in: relatedIds } } } },
        ],
      },
      select: { brandId: true },
      distinct: ["brandId"],
    });

    const brandIds = withBrand.map((p) => p.brandId).filter(Boolean);
    if (brandIds.length === 0) return res.send([]);

    const rows = await brands().findMany({
      where: { id: { in: brandIds }, status: "show" },
      orderBy: { name: "asc" },
    });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getBrandById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Marca no encontrada.");
    const row = await brands().findUnique({ where: { id: req.params.id } });
    if (!row) return notFound(res, "Marca no encontrada.");
    res.send(toApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateBrand = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Marca no encontrada.");
    const current = await brands().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Marca no encontrada.");

    const data = toRow(req.body);
    // El panel puede enviar un solo idioma; se fusiona para no perder el resto.
    if (req.body.name !== undefined) {
      data.name = { ...(current.name || {}), ...(req.body.name || {}) };
    }

    await brands().update({ where: { id: req.params.id }, data });
    invalidateBrands();
    res.send({ message: "Marca actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Marca no encontrada.");
    const status = req.body.status;
    await brands().update({ where: { id: req.params.id }, data: { status } });
    invalidateBrands();
    res.status(200).send({
      message: `Marca ${status === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteBrand = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Marca no encontrada.");
    await brands().delete({ where: { id: req.params.id } });
    invalidateBrands();
    res.status(200).send({ message: "Marca eliminada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyBrands = async (req, res) => {
  try {
    await brands().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    invalidateBrands();
    res.status(200).send({ message: "Marcas eliminadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyBrands = async (req, res) => {
  try {
    const data = toRow(req.body);
    await brands().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    invalidateBrands();
    res.send({ message: "Marcas actualizadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addBrand,
  addAllBrands,
  getAllBrands,
  getShowingBrands,
  getBrandById,
  updateBrand,
  updateStatus,
  deleteBrand,
  deleteManyBrands,
  updateManyBrands,
};
