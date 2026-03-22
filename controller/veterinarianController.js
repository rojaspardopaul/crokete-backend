const Veterinarian = require("../models/Veterinarian");

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// GET /vet/veterinarians/public — Active vets for customer-facing pages
const getActiveVeterinarians = async (req, res) => {
  try {
    const vets = await Veterinarian.find({ status: "active" })
      .select("name specialties image bio availability")
      .sort({ name: 1 });

    res.status(200).send(vets);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /vet/veterinarians
const getAllVeterinarians = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const pages = Number(page);
    const limits = Number(limit);

    const filter = {};
    if (status) filter.status = status;

    const vets = await Veterinarian.find(filter)
      .sort({ createdAt: -1 })
      .skip((pages - 1) * limits)
      .limit(limits);

    const totalDoc = await Veterinarian.countDocuments(filter);

    res.status(200).send({ vets, totalDoc, limits, pages });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /vet/veterinarians/:id
const getVeterinarian = async (req, res) => {
  try {
    const vet = await Veterinarian.findById(req.params.id);
    if (!vet) {
      return res.status(404).send({ message: "Veterinario no encontrado" });
    }
    res.status(200).send(vet);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// POST /vet/veterinarians
const createVeterinarian = async (req, res) => {
  try {
    const { name, email, phone, specialties, image, bio, licenseNumber, availability } =
      req.body;

    if (!name || !email) {
      return res
        .status(400)
        .send({ message: "Nombre y email son requeridos" });
    }

    const existing = await Veterinarian.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(400)
        .send({ message: "Ya existe un veterinario con ese email" });
    }

    const vet = await Veterinarian.create({
      name,
      email,
      phone,
      specialties: specialties || [],
      image,
      bio,
      licenseNumber,
      availability: availability || [],
    });

    res.status(201).send({ message: "Veterinario creado", vet });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PUT /vet/veterinarians/:id
const updateVeterinarian = async (req, res) => {
  try {
    const vet = await Veterinarian.findById(req.params.id);
    if (!vet) {
      return res.status(404).send({ message: "Veterinario no encontrado" });
    }

    const allowedFields = [
      "name",
      "email",
      "phone",
      "specialties",
      "image",
      "bio",
      "licenseNumber",
      "availability",
      "status",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        vet[field] = req.body[field];
      }
    }

    await vet.save();
    res.status(200).send({ message: "Veterinario actualizado", vet });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// DELETE /vet/veterinarians/:id
const deleteVeterinarian = async (req, res) => {
  try {
    const vet = await Veterinarian.findById(req.params.id);
    if (!vet) {
      return res.status(404).send({ message: "Veterinario no encontrado" });
    }

    await Veterinarian.deleteOne({ _id: req.params.id });
    res.status(200).send({ message: "Veterinario eliminado" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PATCH /vet/veterinarians/:id/status
const toggleVeterinarianStatus = async (req, res) => {
  try {
    const vet = await Veterinarian.findById(req.params.id);
    if (!vet) {
      return res.status(404).send({ message: "Veterinario no encontrado" });
    }

    vet.status = vet.status === "active" ? "inactive" : "active";
    await vet.save();

    res
      .status(200)
      .send({ message: `Veterinario ${vet.status}`, status: vet.status });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

module.exports = {
  getActiveVeterinarians,
  getAllVeterinarians,
  getVeterinarian,
  createVeterinarian,
  updateVeterinarian,
  deleteVeterinarian,
  toggleVeterinarianStatus,
};
