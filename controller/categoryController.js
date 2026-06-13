const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const { invalidateCategories, invalidateAll } = require("../lib/cache/invalidation");
const {
  buildCategoryTree,
  normalizeId,
  normalizeEntityId,
  VISIBLE_STATUS_FILTER,
} = require("../utils/categoryHierarchy");

const addCategory = async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    await newCategory.save();
    invalidateCategories();
    res.status(200).send({
      message: "¡Categoría agregada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// all multiple category
const addAllCategory = async (req, res) => {
  // console.log("category", req.body);
  try {
    await Category.deleteMany();

    await Category.insertMany(req.body);

    invalidateAll();
    res.status(200).send({
      message: "¡Categoría agregada correctamente!",
    });
  } catch (err) {
    // console.log(err.message);

    res.status(500).send({
      message: err.message,
    });
  }
};

// get status show category
const getShowingCategory = async (req, res) => {
  try {
    const categories = await Category.find({ status: "show" }).sort({ _id: -1 }).lean();
    const data = await buildShowingCategoryTree(categories);

    // relatedBrands depends on live product-brand relations and must not be stale.
    res.set("Cache-Control", "no-store");
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// get all category parent and child
const getAllCategory = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ _id: -1 }).lean();

    const categoryList = buildCategoryTree(categories);
    //  console.log('categoryList',categoryList)
    res.send(categoryList);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ _id: -1 });

    res.send(categories);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    res.send(category);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// category update
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (category) {
      category.name = { ...category.name, ...req.body.name };
      category.description = {
        ...category.description,
        ...req.body.description,
      };
      category.icon = req.body.icon;
      category.status = req.body.status;
      category.parentId = req.body.parentId
        ? req.body.parentId
        : category.parentId;
      category.parentName = req.body.parentName;

      await category.save();
      invalidateCategories();
      res.send({ message: "¡Categoría actualizada correctamente!" });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// udpate many category
const updateManyCategory = async (req, res) => {
  try {
    const updatedData = {};
    for (const key of Object.keys(req.body)) {
      if (
        req.body[key] !== "[]" &&
        Object.entries(req.body[key]).length > 0 &&
        req.body[key] !== req.body.ids
      ) {
        updatedData[key] = req.body[key];
      }
    }

    await Category.updateMany(
      { _id: { $in: req.body.ids } },
      {
        $set: updatedData,
      },
      {
        multi: true,
      }
    );

    invalidateCategories();
    res.send({
      message: "¡Categorías actualizadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// category update status
const updateStatus = async (req, res) => {
  // console.log('update status')
  try {
    const newStatus = req.body.status;

    await Category.updateOne(
      { _id: req.params.id },
      {
        $set: {
          status: newStatus,
        },
      }
    );
    invalidateCategories();
    res.status(200).send({
      message: `Categoría ${newStatus === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};
//single category delete
const deleteCategory = async (req, res) => {
  try {
    console.log("id cat >>", req.params.id);
    await Category.deleteOne({ _id: req.params.id });
    await Category.deleteMany({ parentId: req.params.id });
    invalidateCategories();
    res.status(200).send({
      message: "¡Categoría eliminada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }

  //This is for delete children category
  // Category.updateOne(
  //   { _id: req.params.id },
  //   {
  //     $pull: { children: req.body.title },
  //   },
  //   (err) => {
  //     if (err) {
  //       res.status(500).send({ message: err.message });
  //     } else {
  //       res.status(200).send({
  //         message: '¡Categoría eliminada correctamente!',
  //       });
  //     }
  //   }
  // );
};

// all multiple category delete
const deleteManyCategory = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ _id: -1 });

    await Category.deleteMany({ parentId: req.body.ids });
    await Category.deleteMany({ _id: req.body.ids });

    invalidateCategories();
    res.status(200).send({
      message: "¡Categorías eliminadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};
const buildShowingCategoryTree = async (categories) => {
  const categoryTree = buildCategoryTree(categories);

  if (categories.length === 0) {
    return categoryTree;
  }

  const visibleCategoryIds = new Set(
    categories.map((category) => normalizeId(category._id)).filter(Boolean)
  );

  const products = await Product.find({
    brand: { $ne: null },
    ...VISIBLE_STATUS_FILTER,
  })
    .select("brand categories category")
    .lean();

  const directBrandsByCategory = new Map();
  const usedBrandIds = new Set();

  for (const product of products) {
    const productBrandId = normalizeEntityId(product.brand);

    if (!productBrandId) {
      continue;
    }

    const relatedCategoryIds = new Set(
      [...(product.categories || []), product.category]
        .map((value) => normalizeEntityId(value))
        .filter((value) => value && visibleCategoryIds.has(value))
    );

    if (relatedCategoryIds.size === 0) {
      continue;
    }

    usedBrandIds.add(productBrandId);

    for (const categoryId of relatedCategoryIds) {
      if (!directBrandsByCategory.has(categoryId)) {
        directBrandsByCategory.set(categoryId, new Set());
      }

      directBrandsByCategory.get(categoryId).add(productBrandId);
    }
  }

  const brands = await Brand.find({
    _id: { $in: Array.from(usedBrandIds) },
    ...VISIBLE_STATUS_FILTER,
  })
    .select("name image status")
    .lean();

  const brandById = new Map(
    brands.map((brand) => [
      normalizeId(brand._id),
      {
        _id: brand._id,
        name: brand.name,
        image: brand.image,
        status: brand.status,
      },
    ])
  );

  return categoryTree.map((node) => decorateCategoryNode(node, directBrandsByCategory, brandById).node);
};

const decorateCategoryNode = (categoryNode, directBrandsByCategory, brandById) => {
  const decoratedChildren = categoryNode.children.map((childNode) =>
    decorateCategoryNode(childNode, directBrandsByCategory, brandById)
  );

  const relatedBrandIds = new Set(
    directBrandsByCategory.get(normalizeId(categoryNode._id)) || []
  );

  for (const child of decoratedChildren) {
    child.relatedBrandIds.forEach((brandId) => relatedBrandIds.add(brandId));
  }

  return {
    node: {
      ...categoryNode,
      children: decoratedChildren.map((child) => child.node),
      relatedBrands: Array.from(relatedBrandIds)
        .map((brandId) => brandById.get(brandId))
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
