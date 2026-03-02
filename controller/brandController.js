const Brand = require("../models/Brand");

const addBrand = async (req, res) => {
  try {
    const newBrand = new Brand(req.body);
    await newBrand.save();
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
    const brands = await Brand.find({ status: "show" }).sort({ name: 1 });
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
