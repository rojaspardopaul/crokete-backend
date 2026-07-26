const { getPrisma } = require("../lib/prisma");
const { vetConfigToApi } = require("../lib/prisma/presenters");
const { fail } = require("../lib/prisma/helpers");

// ==========================================
// HELPERS
// ==========================================

const DEFAULT_DURATIONS = [
  { minutes: 15, label: "15 minutos", price: 200 },
  { minutes: 30, label: "30 minutos", price: 350 },
  { minutes: 60, label: "60 minutos", price: 600 },
];

const DEFAULT_TIERS = [
  { minSpent: 3000, discountPercent: 10, label: "Cliente Frecuente - 10%" },
  { minSpent: 8000, discountPercent: 20, label: "Cliente Premium - 20%" },
  { minSpent: 15000, discountPercent: 30, label: "Cliente VIP - 30%" },
];

/**
 * Fila única de configuración. Se devuelve ya presentada (`workingHours`
 * reagrupado y Decimal → número), que es como la consumen los controladores.
 */
const getOrCreateConfig = async () => {
  const existing = await getPrisma().vetConfig.findFirst();
  if (existing) return vetConfigToApi(existing);

  const created = await getPrisma().vetConfig.create({
    data: {
      enabled: false,
      durations: DEFAULT_DURATIONS,
      discountTiers: DEFAULT_TIERS,
      freeThreshold: 0,
      advanceBookingDays: 30,
      minBookingHoursAhead: 24,
      videoPlatform: "jitsi",
      workingHoursStart: "09:00",
      workingHoursEnd: "18:00",
      workingDays: [1, 2, 3, 4, 5],
      cancellationHoursLimit: 12,
      maxDailyConsultations: 20,
      customerInstructions: "",
    },
  });
  return vetConfigToApi(created);
};

// ==========================================
// PUBLIC ENDPOINT (no auth required)
// ==========================================

// GET /vet/public-config
const getPublicVetConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();

    // If disabled, return minimal response
    if (!config.enabled) {
      return res.status(200).send({ enabled: false });
    }

    res.status(200).send({
      enabled: true,
      durations: config.durations,
      discountTiers: config.discountTiers,
      freeThreshold: config.freeThreshold,
      advanceBookingDays: config.advanceBookingDays,
      minBookingHoursAhead: config.minBookingHoursAhead,
      workingHours: config.workingHours,
      workingDays: config.workingDays,
      cancellationHoursLimit: config.cancellationHoursLimit,
      customerInstructions: config.customerInstructions,
    });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /vet/config
const getVetConfig = async (req, res) => {
  try {
    res.status(200).send(await getOrCreateConfig());
  } catch (err) {
    fail(res, err);
  }
};

/** Campos que el panel puede escribir tal cual. */
const EDITABLE = [
  "enabled",
  "durations",
  "discountTiers",
  "freeThreshold",
  "advanceBookingDays",
  "minBookingHoursAhead",
  "videoPlatform",
  "workingDays",
  "cancellationHoursLimit",
  "maxDailyConsultations",
  "customerInstructions",
];

// PUT /vet/config
const updateVetConfig = async (req, res) => {
  try {
    const current = await getOrCreateConfig();
    const updates = req.body;

    const data = {};
    for (const field of EDITABLE) {
      if (updates[field] !== undefined) data[field] = updates[field];
    }
    // El panel sigue enviando el subdocumento `workingHours`.
    if (updates.workingHours !== undefined) {
      const { start, end } = updates.workingHours || {};
      if (start !== undefined) data.workingHoursStart = start;
      if (end !== undefined) data.workingHoursEnd = end;
    }

    const config = vetConfigToApi(
      await getPrisma().vetConfig.update({ where: { id: current._id }, data })
    );
    res.status(200).send({ message: "Configuración veterinaria actualizada", config });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  getOrCreateConfig,
  getPublicVetConfig,
  getVetConfig,
  updateVetConfig,
};
