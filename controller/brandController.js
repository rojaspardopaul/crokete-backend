const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const { invalidateBrands, invalidateAll } = require("../lib/cache/invalidation");
const {
  findDescendantCategoryIds,
  VISIBLE_STATUS_FILTER,
} = require("../utils/categoryHierarchy");

const addBrand = async (req, res) => {
  try {
    const newBrand = new Brand(req.body);
    await newBrand.save();
    invalidateBrands();
    res.status(200).send({
      message: "Marca agregada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const addAllBrands = async (req, res) => {
  try {
    await Brand.deleteMany();
    await Brand.insertMany(req.body);
    invalidateAll();
    res.status(200).send({
      message: "Marcas agregadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({}).sort({ _id: -1 });
    res.send(brands);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShowingBrands = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      const brands = await Brand.find({ status: "show" }).sort({ name: 1 });
      return res.send(brands);
    }

    if (!mongoose.Types.ObjectId.isValid(String(category))) {
      return res.send([]);
    }

    const categories = await Category.find({ status: "show" })
      .select("_id parentId")
      .lean();

    const relatedCategoryIds = findDescendantCategoryIds(categories, category);

    if (relatedCategoryIds.length === 0) {
      return res.send([]);
    }

    // $and is required here — two separate $or clauses (status + category) can't
    // coexist at the same query level without one overwriting the other.
    const brandIds = await Product.find({
      brand: { $ne: null },
      $and: [
        VISIBLE_STATUS_FILTER,
        {
          $or: [
            { categories: { $in: relatedCategoryIds } },
            { category: { $in: relatedCategoryIds } },
          ],
        },
      ],
    }).distinct("brand");

    const brands = await Brand.find({
      _id: { $in: brandIds },
      ...VISIBLE_STATUS_FILTER,
    }).sort({ name: 1 });

    res.send(brands);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    res.send(brand);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (brand) {
      brand.name = { ...brand.name, ...req.body.name };
      brand.image = req.body.image;
      brand.status = req.body.status;
      await brand.save();
      invalidateBrands();
      res.send({ message: "Marca actualizada correctamente!" });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const newStatus = req.body.status;
    await Brand.updateOne(
      { _id: req.params.id },
      { $set: { status: newStatus } }
    );
    invalidateBrands();
    res.status(200).send({
      message: `Marca ${newStatus === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteBrand = async (req, res) => {
  try {
    await Brand.deleteOne({ _id: req.params.id });
    invalidateBrands();
    res.status(200).send({
      message: "Marca eliminada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteManyBrands = async (req, res) => {
  try {
    await Brand.deleteMany({ _id: req.body.ids });
    invalidateBrands();
    res.status(200).send({
      message: "Marcas eliminadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateManyBrands = async (req, res) => {
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
    await Brand.updateMany(
      { _id: { $in: req.body.ids } },
      { $set: updatedData },
      { multi: true }
    );
    invalidateBrands();
    res.send({
      message: "Marcas actualizadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
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
