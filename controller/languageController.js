const Language = require("../models/Language");
const { mongo_connection } = require("../config/db"); // CCDev

const addLanguage = async (req, res) => {
  try {
    const { name, code, flag } = req.body;
    const exist = await Language.findOne({ name, code, flag });
    if (exist) {
      return res.status(400).send({
        message: "¡El idioma ya existe!",
      });
    }
    const newLanguage = new Language(req.body);
    await newLanguage.save();
    res.send({
      message: "¡Idioma agregado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const addAllLanguage = async (req, res) => {
  try {
    await Language.insertMany(req.body);
    res.send({ message: "¡Zonas agregadas correctamente!" });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllLanguages = async (req, res) => {
  // console.log('get all language')
  try {
    const languages = await Language.find({});
    // console.log('languages',languages)
    res.send(languages);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShowingLanguage = async (req, res) => {
  try {
    // console.log("getShowingLanguage");

    // console.log('get showing language')
    const languages = await Language.find({ status: "show" }).sort({
      _id: -1,
    });
    res.send(languages);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getLanguageById = async (req, res) => {
  try {
    const language = await Language.findById(req.params.id);
    res.send(language);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateLanguage = async (req, res) => {
  try {
    const language = await Language.findById(req.params.id);
    if (language) {
      language.name = req.body.name;
      language.code = req.body.code;
      language.flag = req.body.flag;
      language.status = req.body.status;
    }
    await language.save();
    res.send({
      message: "¡Idioma actualizado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateManyLanguage = async (req, res) => {
  try {
    await Language.updateMany(
      { _id: { $in: req.body.ids } },
      {
        $set: {
          status: req.body.status,
        },
      },
      {
        multi: true,
      }
    );

    res.send({
      message: "¡Idiomas actualizados correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const newStatus = req.body.status;

    await Language.updateOne(
      { _id: req.params.id },
      {
        $set: {
          status: req.body.status,
        },
      }
    );
    res.status(200).send({
      message: `Idioma ${newStatus === "show" ? "publicado" : "ocultado"} correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteLanguage = async (req, res) => {
  try {
    await Language.deleteOne({ _id: req.params.id });
    res.send({
      message: "¡Idioma eliminado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteManyLanguage = async (req, res) => {
  try {
    await Language.deleteMany({ _id: req.body.ids });
    res.send({
      message: `¡Idioma eliminado correctamente!`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
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
