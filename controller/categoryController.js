const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");
const { invalidateCategories, invalidateAll } = require("../lib/cache/invalidation");
const { buildCategoryTree, normalizeId, normalizeEntityId } = require("../utils/categoryHierarchy");

const prisma = () => getPrisma();
const categories = () => getPrisma().category;

/** Texto de un campo multi-idioma, para los campos planos que espera el panel. */
function localized(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.es || value.en || Object.values(value)[0] || "";
}

/**
 * Forma heredada de categoría. `parentName` era un campo desnormalizado en
 * Mongo; aquí se deriva de la relación real, que es la fuente de verdad.
 */
function categoryToApi(c) {
  return {
    ...toApi(c),
    parentId: c.parentId || null,
    parentName: c.parent ? localized(c.parent.name) : "",
  };
}

const WITH_PARENT = { parent: { select: { name: true } } };

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.description !== undefined) row.description = body.description;
  if (body.slug !== undefined) row.slug = body.slug || null;
  if (body.icon !== undefined) row.icon = body.icon;
  if (body.status !== undefined) row.status = body.status;
  if (body.parentId !== undefined) row.parentId = isUuid(body.parentId) ? body.parentId : null;
  return row;
}

const addCategory = async (req, res) => {
  try {
    await categories().create({ data: toRow(req.body) });
    invalidateCategories();
    res.status(200).send({ message: "¡Categoría agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllCategory = async (req, res) => {
  try {
    await categories().deleteMany();
    // Se insertan de una en una porque las hijas necesitan que la padre exista.
    for (const item of req.body || []) {
      await categories().create({ data: toRow(item) });
    }
    invalidateAll();
    res.status(200).send({ message: "¡Categoría agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getShowingCategory = async (req, res) => {
  try {
    const rows = await categories().findMany({
      where: { status: "show" },
      include: WITH_PARENT,
      orderBy: { createdAt: "desc" },
    });
    const data = await buildShowingCategoryTree(rows.map(categoryToApi));

    // relatedBrands depende de relaciones producto-marca vivas: no debe cachearse.
    res.set("Cache-Control", "no-store");
    res.send(data);
  } catch (err) {
    fail(res, err);
  }
};

const getAllCategory = async (req, res) => {
  try {
    const rows = await categories().findMany({
      include: WITH_PARENT,
      orderBy: { createdAt: "desc" },
    });
    res.send(buildCategoryTree(rows.map(categoryToApi)));
  } catch (err) {
    fail(res, err);
  }
};

const getAllCategories = async (req, res) => {
  try {
    const rows = await categories().findMany({
      include: WITH_PARENT,
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(categoryToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getCategoryById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Categoría no encontrada.");
    const row = await categories().findUnique({
      where: { id: req.params.id },
      include: WITH_PARENT,
    });
    if (!row) return notFound(res, "Categoría no encontrada.");
    res.send(categoryToApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateCategory = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Categoría no encontrada.");
    const current = await categories().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Categoría no encontrada.");

    const data = toRow(req.body);
    // El panel puede enviar un único idioma: se fusiona con lo existente.
    if (req.body.name !== undefined) {
      data.name = { ...(current.name || {}), ...(req.body.name || {}) };
    }
    if (req.body.description !== undefined) {
      data.description = { ...(current.description || {}), ...(req.body.description || {}) };
    }
    // Sin parentId en el body se conserva el actual (comportamiento heredado).
    if (!req.body.parentId) delete data.parentId;

    await categories().update({ where: { id: req.params.id }, data });
    invalidateCategories();
    res.send({ message: "¡Categoría actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyCategory = async (req, res) => {
  try {
    const data = toRow(req.body);
    delete data.name; // no tiene sentido aplicar el mismo nombre a varias
    await categories().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    invalidateCategories();
    res.send({ message: "¡Categorías actualizadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Categoría no encontrada.");
    const status = req.body.status;
    await categories().update({ where: { id: req.params.id }, data: { status } });
    invalidateCategories();
    res.status(200).send({
      message: `Categoría ${status === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteCategory = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Categoría no encontrada.");
    // Se replica el comportamiento heredado: borrar la categoría arrastra a sus
    // hijas directas (la FK sólo pondría parentId a NULL).
    await categories().deleteMany({ where: { parentId: req.params.id } });
    await categories().delete({ where: { id: req.params.id } });
    invalidateCategories();
    res.status(200).send({ message: "¡Categoría eliminada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyCategory = async (req, res) => {
  try {
    const ids = uuidList(req.body.ids);
    await categories().deleteMany({ where: { parentId: { in: ids } } });
    await categories().deleteMany({ where: { id: { in: ids } } });
    invalidateCategories();
    res.status(200).send({ message: "¡Categorías eliminadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Añade a cada nodo del árbol las marcas disponibles bajo esa categoría,
 * propagando las de las hijas hacia la madre (el menú de la tienda las muestra
 * al pasar el cursor).
 */
const buildShowingCategoryTree = async (cats) => {
  const categoryTree = buildCategoryTree(cats);
  if (cats.length === 0) return categoryTree;

  const visibleCategoryIds = new Set(cats.map((c) => normalizeId(c._id)).filter(Boolean));

  const products = await prisma().product.findMany({
    where: { brandId: { not: null }, status: "show" },
    select: { brandId: true, categoryId: true, categories: { select: { categoryId: true } } },
  });

  const directBrandsByCategory = new Map();
  const usedBrandIds = new Set();

  for (const product of products) {
    const brandId = normalizeEntityId(product.brandId);
    if (!brandId) continue;

    const relatedCategoryIds = new Set(
      [...product.categories.map((pc) => pc.categoryId), product.categoryId]
        .map(normalizeEntityId)
        .filter((id) => id && visibleCategoryIds.has(id))
    );
    if (relatedCategoryIds.size === 0) continue;

    usedBrandIds.add(brandId);
    for (const categoryId of relatedCategoryIds) {
      if (!directBrandsByCategory.has(categoryId)) {
        directBrandsByCategory.set(categoryId, new Set());
      }
      directBrandsByCategory.get(categoryId).add(brandId);
    }
  }

  const brands = await prisma().brand.findMany({
    where: { id: { in: Array.from(usedBrandIds) }, status: "show" },
    select: { id: true, name: true, image: true, status: true },
  });

  const brandById = new Map(
    brands.map((b) => [
      normalizeId(b.id),
      { _id: b.id, id: b.id, name: b.name, image: b.image, status: b.status },
    ])
  );

  return categoryTree.map(
    (node) => decorateCategoryNode(node, directBrandsByCategory, brandById).node
  );
};

const decorateCategoryNode = (categoryNode, directBrandsByCategory, brandById) => {
  const decoratedChildren = categoryNode.children.map((child) =>
    decorateCategoryNode(child, directBrandsByCategory, brandById)
  );

  const relatedBrandIds = new Set(
    directBrandsByCategory.get(normalizeId(categoryNode._id)) || []
  );
  for (const child of decoratedChildren) {
    child.relatedBrandIds.forEach((id) => relatedBrandIds.add(id));
  }

  return {
    node: {
      ...categoryNode,
      children: decoratedChildren.map((c) => c.node),
      relatedBrands: Array.from(relatedBrandIds)
        .map((id) => brandById.get(id))
        .filter(Boolean),
    },
    relatedBrandIds,
  };
};

module.exports = {
  addCategory,
  addAllCategory,
  getAllCategory,
  getShowingCategory,
  getCategoryById,
  updateCategory,
  updateStatus,
  deleteCategory,
  deleteManyCategory,
  getAllCategories,
  updateManyCategory,
};
