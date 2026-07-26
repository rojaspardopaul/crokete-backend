const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, fail, notFound } = require("../lib/prisma/helpers");

const vets = () => getPrisma().veterinarian;

/** El correo se guarda en minúsculas para poder compararlo sin sorpresas. */
const lowerEmail = (email) => String(email || "").toLowerCase();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// GET /vet/veterinarians/public — Active vets for customer-facing pages
const getActiveVeterinarians = async (req, res) => {
  try {
    const rows = await vets().findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        specialties: true,
        image: true,
        bio: true,
        availability: true,
      },
      orderBy: { name: "asc" },
    });

    res.status(200).send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /vet/veterinarians
const getAllVeterinarians = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const pages = Number(page) || 1;
    const limits = Number(limit) || 50;

    const where = {};
    if (status) where.status = status;

    const [rows, totalDoc] = await Promise.all([
      vets().findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pages - 1) * limits,
        take: limits,
      }),
      vets().count({ where }),
    ]);

    res.status(200).send({ vets: rows.map(toApi), totalDoc, limits, pages });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/veterinarians/:id
const getVeterinarian = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Veterinario no encontrado");
    const vet = await vets().findUnique({ where: { id: req.params.id } });
    if (!vet) return notFound(res, "Veterinario no encontrado");
    res.status(200).send(toApi(vet));
  } catch (err) {
    fail(res, err);
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

    const existing = await vets().findFirst({ where: { email: lowerEmail(email) } });
    if (existing) {
      return res
        .status(400)
        .send({ message: "Ya existe un veterinario con ese email" });
    }

    const vet = await vets().create({
      data: {
        name,
        email: lowerEmail(email),
        phone,
        specialties: specialties || [],
        image,
        bio,
        licenseNumber,
        availability: availability || [],
      },
    });

    res.status(201).send({ message: "Veterinario creado", vet: toApi(vet) });
  } catch (err) {
    fail(res, err);
  }
};

/** Campos que el panel puede escribir. */
const EDITABLE = [
  "name",
  "phone",
  "specialties",
  "image",
  "bio",
  "licenseNumber",
  "availability",
  "status",
];

// PUT /vet/veterinarians/:id
const updateVeterinarian = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Veterinario no encontrado");
    const current = await vets().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Veterinario no encontrado");

    const data = {};
    for (const field of EDITABLE) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (req.body.email !== undefined) data.email = lowerEmail(req.body.email);

    const vet = await vets().update({ where: { id: req.params.id }, data });
    res.status(200).send({ message: "Veterinario actualizado", vet: toApi(vet) });
  } catch (err) {
    fail(res, err);
  }
};

// DELETE /vet/veterinarians/:id
const deleteVeterinarian = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Veterinario no encontrado");

    const appointments = await getPrisma().vetAppointment.count({
      where: { veterinarianId: req.params.id },
    });
    if (appointments > 0) {
      // Las citas guardan el historial clínico y apuntan al veterinario: se
      // desactiva en vez de romper ese vínculo.
      return res.status(409).send({
        message:
          "No se puede eliminar un veterinario con consultas registradas. Desactívalo en su lugar.",
      });
    }

    const deleted = await vets().deleteMany({ where: { id: req.params.id } });
    if (deleted.count === 0) return notFound(res, "Veterinario no encontrado");

    res.status(200).send({ message: "Veterinario eliminado" });
  } catch (err) {
    fail(res, err);
  }
};

// PATCH /vet/veterinarians/:id/status
const toggleVeterinarianStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Veterinario no encontrado");
    const current = await vets().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Veterinario no encontrado");

    const status = current.status === "active" ? "inactive" : "active";
    await vets().update({ where: { id: req.params.id }, data: { status } });

    res.status(200).send({ message: `Veterinario ${status}`, status });
  } catch (err) {
    fail(res, err);
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
