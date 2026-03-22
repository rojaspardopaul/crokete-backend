const VetConfig = require("../models/VetConfig");

// ==========================================
// HELPERS
// ==========================================

const getOrCreateConfig = async () => {
  let config = await VetConfig.findOne();
  if (!config) {
    config = await VetConfig.create({
      enabled: false,
      durations: [
        { minutes: 15, label: "15 minutos", price: 200 },
        { minutes: 30, label: "30 minutos", price: 350 },
        { minutes: 60, label: "60 minutos", price: 600 },
      ],
      discountTiers: [
        { minSpent: 3000, discountPercent: 10, label: "Cliente Frecuente - 10%" },
        { minSpent: 8000, discountPercent: 20, label: "Cliente Premium - 20%" },
        { minSpent: 15000, discountPercent: 30, label: "Cliente VIP - 30%" },
      ],
      freeThreshold: 0,
      advanceBookingDays: 30,
      minBookingHoursAhead: 24,
      videoPlatform: "jitsi",
      workingHours: { start: "09:00", end: "18:00" },
      workingDays: [1, 2, 3, 4, 5],
      cancellationHoursLimit: 12,
      maxDailyConsultations: 20,
      customerInstructions: "",
    });
  }
  return config;
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
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET /vet/config
const getVetConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.status(200).send(config);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PUT /vet/config
const updateVetConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const updates = req.body;

    const allowedFields = [
      "enabled",
      "durations",
      "discountTiers",
      "freeThreshold",
      "advanceBookingDays",
      "minBookingHoursAhead",
      "videoPlatform",
      "workingHours",
      "workingDays",
      "cancellationHoursLimit",
      "maxDailyConsultations",
      "customerInstructions",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        config[field] = updates[field];
      }
    }

    await config.save();
    res.status(200).send({ message: "Configuración veterinaria actualizada", config });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

module.exports = {
  getOrCreateConfig,
  getPublicVetConfig,
  getVetConfig,
  updateVetConfig,
};
