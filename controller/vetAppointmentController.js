const { getOrCreateConfig } = require("./vetConfigController");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const vetAppointmentEmail = require("../lib/email-sender/templates/vet-appointment");
const CONFIG = require("../config");
const { getPrisma } = require("../lib/prisma");
const { toApi, num, vetAppointmentToApi } = require("../lib/prisma/presenters");
const { isUuid, fail, notFound } = require("../lib/prisma/helpers");

const appointments = () => getPrisma().vetAppointment;
const pets = () => getPrisma().customerPet;

/** Estados que no ocupan agenda. */
const INACTIVE_STATUSES = ["cancelled", "rejected", "no_show"];

/** Relaciones que acompañan a la cita en cada vista. */
const VET_BRIEF = { id: true, name: true, specialties: true, image: true };
const PET_BRIEF = { id: true, name: true, species: true, breed: true, image: true };
const PET_FULL = {
  id: true, name: true, species: true, breed: true,
  age: true, weight: true, gender: true, image: true, notes: true,
};

// ==========================================
// HELPERS
// ==========================================

// Fire-and-forget email helper for vet appointments
const sendVetNotificationEmail = async (emailData) => {
  try {
    const html = vetAppointmentEmail(emailData);
    const transporter = nodemailer.createTransport({
      host: CONFIG.EMAIL.SMTP.HOST,
      port: CONFIG.EMAIL.SMTP.PORT,
      secure: CONFIG.EMAIL.SMTP.SECURE,
      auth: {
        user: CONFIG.EMAIL.SMTP.USER,
        pass: CONFIG.EMAIL.SMTP.PASS,
      },
    });

    const statusSubjects = {
      requested: "Solicitud de Consulta Recibida",
      approved: "¡Tu Consulta ha sido Aprobada!",
      rejected: "Consulta No Disponible",
      cancelled: "Consulta Cancelada",
      confirmed: "Consulta Confirmada",
      completed: "Consulta Completada",
    };

    await transporter.sendMail({
      from: CONFIG.EMAIL.FROM,
      to: emailData.email,
      subject: `${statusSubjects[emailData.status] || "Actualización de Consulta"} - ${CONFIG.COMPANY.NAME}`,
      html,
    });
    console.log(`[VET EMAIL] Sent '${emailData.status}' email to ${emailData.email}`);
  } catch (err) {
    console.error(`[VET EMAIL] Failed to send '${emailData.status}' email:`, err.message);
  }
};

// Generate Jitsi meeting URL
const generateJitsiUrl = (appointmentId) => {
  const roomId = `crokete-vet-${appointmentId}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
  return `https://meet.jit.si/${roomId}`;
};

// Calculate discount based on customer's totalSpent
const calculateDiscount = (totalSpent, discountTiers, freeThreshold) => {
  // Check free threshold first
  if (freeThreshold > 0 && totalSpent >= freeThreshold) {
    return 100; // 100% free
  }

  // Sort tiers descending by minSpent, pick the best match
  const sorted = [...discountTiers].sort((a, b) => b.minSpent - a.minSpent);
  for (const tier of sorted) {
    if (totalSpent >= tier.minSpent) {
      return tier.discountPercent;
    }
  }

  return 0; // No discount
};

/** Añade una entrada a la bitácora de estados sin perder las anteriores. */
const appendHistory = (appointment, entry) => [
  ...(Array.isArray(appointment.statusHistory) ? appointment.statusHistory : []),
  entry,
];

// Check if a time slot is available for a vet
const isSlotAvailable = async (vetId, date, durationMinutes) => {
  const startTime = new Date(date);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  // El solape se calcula en SQL: el fin de una cita es `date + duration`, un
  // valor derivado que no existe como columna y que Prisma no puede comparar.
  const rows = await getPrisma().$queryRaw`
    SELECT 1
    FROM vet_appointments
    WHERE "veterinarianId" = ${vetId}::uuid
      AND status NOT IN ('cancelled', 'rejected', 'no_show')
      AND date < ${endTime}
      AND date + (duration * interval '1 minute') > ${startTime}
    LIMIT 1`;

  return rows.length === 0;
};

// ==========================================
// CUSTOMER PET ENDPOINTS
// ==========================================

// GET /vet/my-pets
const getMyPets = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false, pets: [] });
    }
    if (!isUuid(req.user._id)) {
      return res.status(200).send({ enabled: true, pets: [] });
    }

    const rows = await pets().findMany({
      where: { customerId: req.user._id, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).send({ enabled: true, pets: rows.map(toApi) });
  } catch (err) {
    fail(res, err);
  }
};

// POST /vet/my-pets
const createMyPet = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res
        .status(400)
        .send({ message: "Servicio veterinario no disponible" });
    }

    const { name, species, breed, age, weight, gender, image, notes } =
      req.body;

    if (!name || !species) {
      return res
        .status(400)
        .send({ message: "Nombre y especie son requeridos" });
    }
    if (!isUuid(req.user._id)) {
      return res.status(401).send({ message: "Sesión inválida" });
    }

    const pet = await pets().create({
      data: {
        customerId: req.user._id,
        name,
        species,
        breed: breed ?? undefined,
        age: age !== undefined && age !== null && age !== "" ? Number(age) : null,
        weight: weight !== undefined && weight !== null && weight !== "" ? Number(weight) : null,
        gender: gender || null,
        image,
        notes: notes ?? undefined,
      },
    });

    res.status(201).send({ message: "Mascota registrada", pet: toApi(pet) });
  } catch (err) {
    fail(res, err);
  }
};

/** Campos que el dueño puede editar de su mascota. */
const PET_EDITABLE = ["name", "species", "breed", "gender", "image", "notes"];

// PUT /vet/my-pets/:id
const updateMyPet = async (req, res) => {
  try {
    if (!isUuid(req.params.id) || !isUuid(req.user._id)) {
      return notFound(res, "Mascota no encontrada");
    }

    const data = {};
    for (const field of PET_EDITABLE) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (req.body.age !== undefined) {
      data.age = req.body.age === null || req.body.age === "" ? null : Number(req.body.age);
    }
    if (req.body.weight !== undefined) {
      data.weight = req.body.weight === null || req.body.weight === "" ? null : Number(req.body.weight);
    }

    // El filtro incluye al dueño: nadie puede editar la mascota de otro.
    const updated = await pets().updateMany({
      where: { id: req.params.id, customerId: req.user._id },
      data,
    });
    if (updated.count === 0) return notFound(res, "Mascota no encontrada");

    const pet = await pets().findUnique({ where: { id: req.params.id } });
    res.status(200).send({ message: "Mascota actualizada", pet: toApi(pet) });
  } catch (err) {
    fail(res, err);
  }
};

// DELETE /vet/my-pets/:id (soft delete)
const deleteMyPet = async (req, res) => {
  try {
    if (!isUuid(req.params.id) || !isUuid(req.user._id)) {
      return notFound(res, "Mascota no encontrada");
    }

    const updated = await pets().updateMany({
      where: { id: req.params.id, customerId: req.user._id },
      data: { status: "inactive" },
    });
    if (updated.count === 0) return notFound(res, "Mascota no encontrada");

    res.status(200).send({ message: "Mascota eliminada" });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// CUSTOMER APPOINTMENT ENDPOINTS
// ==========================================

// GET /vet/my-appointments
const getMyAppointments = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false, appointments: [] });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const pages = Number(page) || 1;
    const limits = Number(limit) || 20;

    if (!isUuid(req.user._id)) {
      return res
        .status(200)
        .send({ enabled: true, appointments: [], totalDoc: 0, limits, pages });
    }

    const where = { customerId: req.user._id };
    if (status) where.status = status;

    const [rows, totalDoc] = await Promise.all([
      appointments().findMany({
        where,
        include: {
          veterinarian: { select: VET_BRIEF },
          customerPet: { select: PET_BRIEF },
        },
        orderBy: { date: "desc" },
        skip: (pages - 1) * limits,
        take: limits,
      }),
      appointments().count({ where }),
    ]);

    res.status(200).send({
      enabled: true,
      appointments: rows.map(vetAppointmentToApi),
      totalDoc,
      limits,
      pages,
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/my-appointments/:id
const getMyAppointment = async (req, res) => {
  try {
    if (!isUuid(req.params.id) || !isUuid(req.user._id)) {
      return notFound(res, "Cita no encontrada");
    }

    const appointment = await appointments().findFirst({
      where: { id: req.params.id, customerId: req.user._id },
      include: {
        veterinarian: {
          select: { ...VET_BRIEF, bio: true, email: true },
        },
        customerPet: { select: PET_FULL },
      },
    });

    if (!appointment) return notFound(res, "Cita no encontrada");

    res.status(200).send(vetAppointmentToApi(appointment));
  } catch (err) {
    fail(res, err);
  }
};

// POST /vet/appointments — Request a new appointment
const requestAppointment = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res
        .status(400)
        .send({ message: "Servicio veterinario no disponible" });
    }

    const { veterinarianId, customerPetId, date, duration, reason, symptoms } =
      req.body;

    // Validations
    if (!veterinarianId || !customerPetId || !date || !duration || !reason) {
      return res.status(400).send({
        message:
          "veterinarianId, customerPetId, date, duration y reason son requeridos",
      });
    }
    if (!isUuid(veterinarianId) || !isUuid(customerPetId)) {
      return res.status(400).send({ message: "Veterinario o mascota no válidos" });
    }
    if (!isUuid(req.user._id)) {
      return res.status(401).send({ message: "Sesión inválida" });
    }

    // Validate duration is in config
    const durationOption = config.durations.find(
      (d) => d.minutes === Number(duration)
    );
    if (!durationOption) {
      return res
        .status(400)
        .send({ message: "Duración de consulta no válida" });
    }

    // Validate vet exists and is active
    const vet = await getPrisma().veterinarian.findUnique({
      where: { id: veterinarianId },
    });
    if (!vet || vet.status !== "active") {
      return res
        .status(400)
        .send({ message: "Veterinario no disponible" });
    }

    // Validate pet belongs to customer
    const pet = await pets().findFirst({
      where: { id: customerPetId, customerId: req.user._id, status: "active" },
    });
    if (!pet) {
      return res
        .status(400)
        .send({ message: "Mascota no encontrada" });
    }

    // Validate date is in the future
    const appointmentDate = new Date(date);
    const now = new Date();
    const minDate = new Date(
      now.getTime() + config.minBookingHoursAhead * 3600000
    );

    if (appointmentDate < minDate) {
      return res.status(400).send({
        message: `La cita debe ser al menos ${config.minBookingHoursAhead} horas en el futuro`,
      });
    }

    const maxDate = new Date(
      now.getTime() + config.advanceBookingDays * 86400000
    );
    if (appointmentDate > maxDate) {
      return res.status(400).send({
        message: `No se puede agendar con más de ${config.advanceBookingDays} días de anticipación`,
      });
    }

    // Validate day of week
    const dayOfWeek = appointmentDate.getDay();
    if (!config.workingDays.includes(dayOfWeek)) {
      return res
        .status(400)
        .send({ message: "Día no disponible para consultas" });
    }

    // Check slot availability
    const available = await isSlotAvailable(
      veterinarianId,
      appointmentDate,
      durationOption.minutes
    );
    if (!available) {
      return res
        .status(400)
        .send({ message: "Horario no disponible, seleccione otro" });
    }

    // Check daily limit
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dailyCount = await appointments().count({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ["cancelled", "rejected"] },
      },
    });

    if (dailyCount >= config.maxDailyConsultations) {
      return res
        .status(400)
        .send({ message: "Se alcanzó el límite de consultas para este día" });
    }

    // Calculate pricing
    const customer = await getPrisma().customer.findUnique({
      where: { id: req.user._id },
    });
    const totalSpent = num(customer?.loyaltyTotalSpent);
    const discountPercent = calculateDiscount(
      totalSpent,
      config.discountTiers,
      config.freeThreshold
    );
    const originalPrice = durationOption.price;
    const finalPrice = Number(
      (originalPrice * (1 - discountPercent / 100)).toFixed(2)
    );

    // Create appointment
    const created = await appointments().create({
      data: {
        customerId: req.user._id,
        veterinarianId,
        customerPetId,
        date: appointmentDate,
        duration: durationOption.minutes,
        reason,
        symptoms: symptoms || [],
        originalPrice,
        discountPercent,
        finalPrice,
        status: "requested",
        meetingPlatform: config.videoPlatform,
        statusHistory: [
          {
            status: "requested",
            changedAt: new Date().toISOString(),
            changedBy: "customer",
            note: "Solicitud de consulta creada",
          },
        ],
      },
      include: {
        veterinarian: { select: VET_BRIEF },
        customerPet: { select: PET_BRIEF },
      },
    });
    const appointment = vetAppointmentToApi(created);

    // Send email notification (fire-and-forget)
    sendVetNotificationEmail({
      name: customer?.name,
      email: customer?.email,
      status: "requested",
      petName: appointment.customerPet?.name,
      vetName: appointment.veterinarian?.name,
      date: appointment.date,
      duration: appointment.duration,
      reason: appointment.reason,
      finalPrice: appointment.finalPrice,
    });

    res.status(201).send({
      message: "Solicitud de consulta enviada",
      appointment,
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /vet/my-appointments/:id/cancel
const cancelMyAppointment = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!isUuid(req.params.id) || !isUuid(req.user._id)) {
      return notFound(res, "Cita no encontrada");
    }

    const current = await appointments().findFirst({
      where: { id: req.params.id, customerId: req.user._id },
    });

    if (!current) return notFound(res, "Cita no encontrada");

    if (["completed", "cancelled", "rejected", "no_show"].includes(current.status)) {
      return res
        .status(400)
        .send({ message: "Esta cita no puede ser cancelada" });
    }

    // Check cancellation time limit
    const hoursUntil =
      (new Date(current.date).getTime() - Date.now()) / 3600000;
    if (
      hoursUntil < config.cancellationHoursLimit &&
      current.status !== "requested"
    ) {
      return res.status(400).send({
        message: `Solo se puede cancelar con al menos ${config.cancellationHoursLimit} horas de anticipación`,
      });
    }

    const updated = await appointments().update({
      where: { id: current.id },
      data: {
        status: "cancelled",
        cancelledBy: "customer",
        cancellationReason: req.body.reason || "",
        statusHistory: appendHistory(current, {
          status: "cancelled",
          changedAt: new Date().toISOString(),
          changedBy: "customer",
          note: req.body.reason || "Cancelada por el cliente",
        }),
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        veterinarian: { select: { id: true, name: true } },
        customerPet: { select: { id: true, name: true } },
      },
    });
    const appointment = vetAppointmentToApi(updated);

    // Send cancellation email (fire-and-forget)
    sendVetNotificationEmail({
      name: appointment.customer?.name,
      email: appointment.customer?.email,
      status: "cancelled",
      petName: appointment.customerPet?.name,
      vetName: appointment.veterinarian?.name,
      date: appointment.date,
      duration: appointment.duration,
      reason: appointment.reason,
      cancellationReason: appointment.cancellationReason,
    });

    res.status(200).send({ message: "Cita cancelada", appointment });
  } catch (err) {
    fail(res, err);
  }
};

/** Horario del día: el del veterinario si lo tiene, si no el global. */
const workingHoursFor = (vet, dayOfWeek, config) => {
  const vetSlot = (Array.isArray(vet.availability) ? vet.availability : []).find(
    (s) => s.dayOfWeek === dayOfWeek
  );
  return vetSlot
    ? { start: vetSlot.start, end: vetSlot.end }
    : { start: config.workingHours.start, end: config.workingHours.end };
};

// GET /vet/available-slots — Get available time slots for a date + vet
const getAvailableSlots = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false, slots: [] });
    }

    const { veterinarianId, date, duration } = req.query;

    if (!veterinarianId || !date || !duration) {
      return res.status(400).send({
        message: "veterinarianId, date y duration son requeridos",
      });
    }

    const durationOption = config.durations.find(
      (d) => d.minutes === Number(duration)
    );
    if (!durationOption) {
      return res
        .status(400)
        .send({ message: "Duración no válida" });
    }

    const vet = isUuid(veterinarianId)
      ? await getPrisma().veterinarian.findUnique({ where: { id: veterinarianId } })
      : null;
    if (!vet || vet.status !== "active") {
      return res
        .status(400)
        .send({ message: "Veterinario no disponible" });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    if (!config.workingDays.includes(dayOfWeek)) {
      return res.status(200).send({ enabled: true, slots: [] });
    }

    // Determine working hours (vet-specific or global)
    const { start: startHour, end: endHour } = workingHoursFor(vet, dayOfWeek, config);

    // Generate time slots
    const [startH, startM] = startHour.split(":").map(Number);
    const [endH, endM] = endHour.split(":").map(Number);

    const slotStart = new Date(targetDate);
    slotStart.setHours(startH, startM, 0, 0);

    const slotEnd = new Date(targetDate);
    slotEnd.setHours(endH, endM, 0, 0);

    const durationMs = durationOption.minutes * 60000;
    const slots = [];

    // Get existing appointments for this vet on this date
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await appointments().findMany({
      where: {
        veterinarianId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: INACTIVE_STATUSES },
      },
      select: { date: true, duration: true },
    });

    let current = new Date(slotStart);
    while (current.getTime() + durationMs <= slotEnd.getTime()) {
      const slotStartTime = new Date(current);
      const slotEndTime = new Date(current.getTime() + durationMs);

      // Check if this slot overlaps with any existing appointment
      const isOccupied = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.date);
        const apptEnd = new Date(apptStart.getTime() + appt.duration * 60000);
        return slotStartTime < apptEnd && slotEndTime > apptStart;
      });

      // Check if slot is in the past
      const isPast =
        slotStartTime.getTime() <
        Date.now() + config.minBookingHoursAhead * 3600000;

      // Determine slot status: available | occupied | past
      let status = "available";
      if (isPast) status = "past";
      else if (isOccupied) status = "occupied";

      slots.push({
        start: slotStartTime.toISOString(),
        end: slotEndTime.toISOString(),
        available: status === "available",
        status,
      });

      // Move to next slot (30 min intervals)
      current = new Date(current.getTime() + 30 * 60000);
    }

    res.status(200).send({ enabled: true, slots });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/available-dates — Get dates with at least one available slot in a month
const getAvailableDates = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false, dates: [] });
    }

    const { veterinarianId, month, duration } = req.query;
    // month format: YYYY-MM

    if (!veterinarianId || !month || !duration) {
      return res.status(400).send({
        message: "veterinarianId, month (YYYY-MM) y duration son requeridos",
      });
    }

    const durationOption = config.durations.find(
      (d) => d.minutes === Number(duration)
    );
    if (!durationOption) {
      return res.status(400).send({ message: "Duración no válida" });
    }

    const vet = isUuid(veterinarianId)
      ? await getPrisma().veterinarian.findUnique({ where: { id: veterinarianId } })
      : null;
    if (!vet || vet.status !== "active") {
      return res.status(400).send({ message: "Veterinario no disponible" });
    }

    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const mon = Number(monthStr) - 1; // JS months 0-based

    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const durationMs = durationOption.minutes * 60000;
    const minBookingTime =
      Date.now() + config.minBookingHoursAhead * 3600000;
    const maxBookingDate = new Date(
      Date.now() + config.advanceBookingDays * 86400000
    );

    // Get all appointments for this vet in this month
    const monthStart = new Date(year, mon, 1);
    const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59, 999);

    const existingAppointments = await appointments().findMany({
      where: {
        veterinarianId,
        date: { gte: monthStart, lte: monthEnd },
        status: { notIn: INACTIVE_STATUSES },
      },
      select: { date: true, duration: true },
    });

    const availableDates = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, mon, d);
      const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = dateObj.getDay();

      // Skip non-working days
      if (!config.workingDays.includes(dayOfWeek)) continue;

      // Skip dates beyond advance booking limit
      if (dateObj > maxBookingDate) continue;

      // Determine working hours
      const { start: startHour, end: endHour } = workingHoursFor(vet, dayOfWeek, config);

      const [startH, startM] = startHour.split(":").map(Number);
      const [endH, endM] = endHour.split(":").map(Number);

      const slotStart = new Date(dateObj);
      slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(dateObj);
      slotEnd.setHours(endH, endM, 0, 0);

      // Filter appointments for this day
      const dayStart = new Date(dateObj);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateObj);
      dayEnd.setHours(23, 59, 59, 999);
      const dayAppointments = existingAppointments.filter((a) => {
        const ad = new Date(a.date);
        return ad >= dayStart && ad <= dayEnd;
      });

      // Check if at least one slot is available
      let hasAvailable = false;
      let current = new Date(slotStart);
      while (current.getTime() + durationMs <= slotEnd.getTime()) {
        const slotStartTime = new Date(current);
        const slotEndTime = new Date(current.getTime() + durationMs);

        const isPast = slotStartTime.getTime() < minBookingTime;
        const isOccupied = dayAppointments.some((appt) => {
          const apptStart = new Date(appt.date);
          const apptEnd = new Date(
            apptStart.getTime() + appt.duration * 60000
          );
          return slotStartTime < apptEnd && slotEndTime > apptStart;
        });

        if (!isPast && !isOccupied) {
          hasAvailable = true;
          break;
        }

        current = new Date(current.getTime() + 30 * 60000);
      }

      if (hasAvailable) {
        availableDates.push(dateStr);
      }
    }

    res.status(200).send({ enabled: true, dates: availableDates });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/my-price-info — Get pricing info for current customer
const getMyPriceInfo = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false });
    }

    const customer = isUuid(req.user._id)
      ? await getPrisma().customer.findUnique({ where: { id: req.user._id } })
      : null;
    const totalSpent = num(customer?.loyaltyTotalSpent);
    const discountPercent = calculateDiscount(
      totalSpent,
      config.discountTiers,
      config.freeThreshold
    );

    const prices = config.durations.map((d) => ({
      minutes: d.minutes,
      label: d.label,
      originalPrice: d.price,
      discountPercent,
      finalPrice: Number((d.price * (1 - discountPercent / 100)).toFixed(2)),
    }));

    res.status(200).send({
      enabled: true,
      totalSpent,
      discountPercent,
      isFree: discountPercent === 100,
      prices,
      discountTiers: config.discountTiers,
      freeThreshold: config.freeThreshold,
    });
  } catch (err) {
    fail(res, err);
  }
};

// ==========================================
// ADMIN APPOINTMENT ENDPOINTS
// ==========================================

/** Columnas por las que el panel puede ordenar la agenda. */
const SORTABLE = ["date", "createdAt", "updatedAt", "status", "finalPrice"];

// GET /vet/admin/appointments
const getAllAppointments = async (req, res) => {
  try {
    const { status, veterinarianId, page = 1, limit = 20, sortBy = "date" } = req.query;
    const pages = Number(page) || 1;
    const limits = Number(limit) || 20;

    const where = {};
    if (status) where.status = status;
    if (veterinarianId && isUuid(veterinarianId)) where.veterinarianId = veterinarianId;

    const orderBy = { [SORTABLE.includes(sortBy) ? sortBy : "date"]: "desc" };

    const [rows, totalDoc] = await Promise.all([
      appointments().findMany({
        where,
        include: {
          customer: {
            select: {
              id: true, name: true, email: true, phone: true,
              loyaltyPoints: true, loyaltyTotalPoints: true, loyaltyTotalSpent: true,
              loyaltyOrderCount: true, loyaltyTier: true, loyaltyJoinedAt: true,
            },
          },
          veterinarian: { select: { id: true, name: true, email: true, specialties: true } },
          customerPet: { select: { id: true, name: true, species: true, breed: true } },
        },
        orderBy,
        skip: (pages - 1) * limits,
        take: limits,
      }),
      appointments().count({ where }),
    ]);

    res.status(200).send({
      appointments: rows.map(vetAppointmentToApi),
      totalDoc,
      limits,
      pages,
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/admin/appointments/:id
const getAppointmentAdmin = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Cita no encontrada");

    const appointment = await appointments().findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          select: {
            id: true, name: true, email: true, phone: true,
            loyaltyPoints: true, loyaltyTotalPoints: true, loyaltyTotalSpent: true,
            loyaltyOrderCount: true, loyaltyTier: true, loyaltyJoinedAt: true,
          },
        },
        veterinarian: {
          select: { id: true, name: true, email: true, specialties: true, phone: true },
        },
        customerPet: { select: PET_FULL },
      },
    });

    if (!appointment) return notFound(res, "Cita no encontrada");

    res.status(200).send(vetAppointmentToApi(appointment));
  } catch (err) {
    fail(res, err);
  }
};

/** Transiciones de estado permitidas desde el panel. */
const VALID_TRANSITIONS = {
  requested: ["approved", "rejected"],
  approved: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
};

// PATCH /vet/admin/appointments/:id/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, note, rejectionReason } = req.body;
    const config = await getOrCreateConfig();

    if (!isUuid(req.params.id)) return notFound(res, "Cita no encontrada");
    const current = await appointments().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Cita no encontrada");

    const allowed = VALID_TRANSITIONS[current.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).send({
        message: `No se puede cambiar de '${current.status}' a '${status}'`,
      });
    }

    // Require rejection reason
    if (status === "rejected") {
      const reason = rejectionReason || note;
      if (!reason || !reason.trim()) {
        return res.status(400).send({
          message: "Debe proporcionar un motivo para rechazar la consulta",
        });
      }
    }

    const data = {
      status,
      statusHistory: appendHistory(current, {
        status,
        changedAt: new Date().toISOString(),
        changedBy: "admin",
        note: (status === "rejected" ? (rejectionReason || note) : note) || "",
      }),
    };

    // Generate meeting URL when approving
    if (status === "approved" && !current.meetingUrl) {
      if (config.videoPlatform === "jitsi") {
        data.meetingUrl = generateJitsiUrl(current.id);
      }
      // Google Meet integration would go here
    }

    if (status === "cancelled") {
      data.cancelledBy = "admin";
      data.cancellationReason = note || "Cancelada por administración";
    }

    if (status === "rejected") {
      data.cancellationReason = rejectionReason || note || "";
    }

    if (req.body.adminNotes !== undefined) {
      data.adminNotes = req.body.adminNotes;
    }

    const updated = await appointments().update({
      where: { id: current.id },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        veterinarian: { select: { id: true, name: true } },
        customerPet: { select: { id: true, name: true, species: true } },
      },
    });
    const appointment = vetAppointmentToApi(updated);

    // Send email notification (fire-and-forget)
    if (appointment.customer?.email) {
      sendVetNotificationEmail({
        name: appointment.customer.name,
        email: appointment.customer.email,
        status,
        petName: appointment.customerPet?.name,
        vetName: appointment.veterinarian?.name,
        date: appointment.date,
        duration: appointment.duration,
        reason: appointment.reason,
        finalPrice: appointment.finalPrice,
        meetingUrl: appointment.meetingUrl,
        cancellationReason: appointment.cancellationReason,
      });
    }

    res.status(200).send({ message: "Estado actualizado", appointment });
  } catch (err) {
    fail(res, err);
  }
};

// PUT /vet/admin/appointments/:id/notes
const updateAppointmentNotes = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Cita no encontrada");
    const current = await appointments().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "Cita no encontrada");

    const { clinicalNotes, diagnosis, recommendations, adminNotes } = req.body;

    // Validate at least one field has content
    const hasClinicNotes = clinicalNotes && clinicalNotes.trim();
    const hasDiagnosis = diagnosis && diagnosis.trim();
    const hasRecommendations = recommendations && recommendations.trim();
    const hasAdminNotes = adminNotes && adminNotes.trim();

    if (!hasClinicNotes && !hasDiagnosis && !hasRecommendations && !hasAdminNotes) {
      return res.status(400).send({
        message: "Debe completar al menos un campo (notas clínicas, diagnóstico o recomendaciones)",
      });
    }

    const data = {};
    if (clinicalNotes !== undefined) data.clinicalNotes = clinicalNotes;
    if (diagnosis !== undefined) data.diagnosis = diagnosis;
    if (recommendations !== undefined) data.recommendations = recommendations;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    const appointment = await appointments().update({
      where: { id: current.id },
      data,
    });
    res
      .status(200)
      .send({ message: "Notas actualizadas", appointment: vetAppointmentToApi(appointment) });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/admin/stats
const getVetStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalAppointments, todayAppointments, pendingRequests, statusCounts] =
      await Promise.all([
        appointments().count(),
        appointments().count({
          where: {
            date: { gte: today, lt: tomorrow },
            status: { notIn: ["cancelled", "rejected"] },
          },
        }),
        appointments().count({ where: { status: "requested" } }),
        appointments().groupBy({ by: ["status"], _count: { _all: true } }),
      ]);

    const statusMap = {};
    statusCounts.forEach((s) => {
      statusMap[s.status] = s._count._all;
    });

    res.status(200).send({
      totalAppointments,
      todayAppointments,
      pendingRequests,
      statusBreakdown: statusMap,
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /vet/admin/pets/:customerId — Get customer's pets (admin view)
const getCustomerPetsAdmin = async (req, res) => {
  try {
    if (!isUuid(req.params.customerId)) return res.status(200).send([]);

    const rows = await pets().findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  // Customer pets
  getMyPets,
  createMyPet,
  updateMyPet,
  deleteMyPet,
  // Customer appointments
  getMyAppointments,
  getMyAppointment,
  requestAppointment,
  cancelMyAppointment,
  getAvailableSlots,
  getAvailableDates,
  getMyPriceInfo,
  // Admin
  getAllAppointments,
  getAppointmentAdmin,
  updateAppointmentStatus,
  updateAppointmentNotes,
  getVetStats,
  getCustomerPetsAdmin,
};
