const Pet = require("../models/Pet");

const addPet = async (req, res) => {
  try {
    const newPet = new Pet(req.body);
    await newPet.save();
    res.status(200).send({
      message: "Mascota agregada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const addAllPets = async (req, res) => {
  try {
    await Pet.deleteMany();
    await Pet.insertMany(req.body);
    res.status(200).send({
      message: "Mascotas agregadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllPets = async (req, res) => {
  try {
    const pets = await Pet.find({}).sort({ _id: -1 });
    res.send(pets);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShowingPets = async (req, res) => {
  try {
    const pets = await Pet.find({ status: "show" }).sort({ name: 1 });
    res.send(pets);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getPetById = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    res.send(pet);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updatePet = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (pet) {
      pet.name = { ...pet.name, ...req.body.name };
      pet.icon = req.body.icon;
      pet.status = req.body.status;
      await pet.save();
      res.send({ message: "Mascota actualizada correctamente!" });
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
    await Pet.updateOne(
      { _id: req.params.id },
      { $set: { status: newStatus } }
    );
    res.status(200).send({
      message: `Mascota ${newStatus === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deletePet = async (req, res) => {
  try {
    await Pet.deleteOne({ _id: req.params.id });
    res.status(200).send({
      message: "Mascota eliminada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteManyPets = async (req, res) => {
  try {
    await Pet.deleteMany({ _id: req.body.ids });
    res.status(200).send({
      message: "Mascotas eliminadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateManyPets = async (req, res) => {
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
    await Pet.updateMany(
      { _id: { $in: req.body.ids } },
      { $set: updatedData },
      { multi: true }
    );
    res.send({
      message: "Mascotas actualizadas correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
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
