const VetAppointment = require("../models/VetAppointment");
const CustomerPet = require("../models/CustomerPet");
const Veterinarian = require("../models/Veterinarian");
const Customer = require("../models/Customer");
const { getOrCreateConfig } = require("./vetConfigController");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const vetAppointmentEmail = require("../lib/email-sender/templates/vet-appointment");
const CONFIG = require("../config");

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

// Check if a time slot is available for a vet
const isSlotAvailable = async (vetId, date, durationMinutes) => {
  const startTime = new Date(date);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  // Find overlapping appointments
  const overlapping = await VetAppointment.findOne({
    veterinarian: vetId,
    date: {
      $lt: endTime,
    },
    status: { $nin: ["cancelled", "rejected", "no_show"] },
    $expr: {
      $gt: [
        { $add: ["$date", { $multiply: ["$duration", 60000] }] },
        startTime,
      ],
    },
  });

  return !overlapping;
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

    const pets = await CustomerPet.find({
      customer: req.user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    res.status(200).send({ enabled: true, pets });
  } catch (err) {
    res.status(500).send({ message: err.message });
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

    const pet = await CustomerPet.create({
      customer: req.user._id,
      name,
      species,
      breed,
      age,
      weight,
      gender,
      image,
      notes,
    });

    res.status(201).send({ message: "Mascota registrada", pet });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PUT /vet/my-pets/:id
const updateMyPet = async (req, res) => {
  try {
    const pet = await CustomerPet.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!pet) {
      return res.status(404).send({ message: "Mascota no encontrada" });
    }

    const allowedFields = [
      "name",
      "species",
      "breed",
      "age",
      "weight",
      "gender",
      "image",
      "notes",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        pet[field] = req.body[field];
      }
    }

    await pet.save();
    res.status(200).send({ message: "Mascota actualizada", pet });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// DELETE /vet/my-pets/:id (soft delete)
const deleteMyPet = async (req, res) => {
  try {
    const pet = await CustomerPet.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!pet) {
      return res.status(404).send({ message: "Mascota no encontrada" });
    }

    pet.status = "inactive";
    await pet.save();

    res.status(200).send({ message: "Mascota eliminada" });
  } catch (err) {
    res.status(500).send({ message: err.message });
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
    const pages = Number(page);
    const limits = Number(limit);

    const filter = { customer: req.user._id };
    if (status) filter.status = status;

    const appointments = await VetAppointment.find(filter)
      .populate("veterinarian", "name specialties image")
      .populate("customerPet", "name species breed image")
      .sort({ date: -1 })
      .skip((pages - 1) * limits)
      .limit(limits);

    const totalDoc = await VetAppointment.countDocuments(filter);

    res.status(200).send({ enabled: true, appointments, totalDoc, limits, pages });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /vet/my-appointments/:id
const getMyAppointment = async (req, res) => {
  try {
    const appointment = await VetAppointment.findOne({
      _id: req.params.id,
      customer: req.user._id,
    })
      .populate("veterinarian", "name specialties image bio email")
      .populate("customerPet", "name species breed age weight gender image notes");

    if (!appointment) {
      return res.status(404).send({ message: "Cita no encontrada" });
    }

    res.status(200).send(appointment);
  } catch (err) {
    res.status(500).send({ message: err.message });
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
    const vet = await Veterinarian.findById(veterinarianId);
    if (!vet || vet.status !== "active") {
      return res
        .status(400)
        .send({ message: "Veterinario no disponible" });
    }

    // Validate pet belongs to customer
    const pet = await CustomerPet.findOne({
      _id: customerPetId,
      customer: req.user._id,
      status: "active",
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

    const dailyCount = await VetAppointment.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (dailyCount >= config.maxDailyConsultations) {
      return res
        .status(400)
        .send({ message: "Se alcanzó el límite de consultas para este día" });
    }

    // Calculate pricing
    const customer = await Customer.findById(req.user._id);
    const totalSpent = customer?.loyalty?.totalSpent || 0;
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
    const appointment = await VetAppointment.create({
      customer: req.user._id,
      veterinarian: veterinarianId,
      customerPet: customerPetId,
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
          changedAt: new Date(),
          changedBy: "customer",
          note: "Solicitud de consulta creada",
        },
      ],
    });

    await appointment.populate("veterinarian", "name specialties image");
    await appointment.populate("customerPet", "name species breed image");

    // Send email notification (fire-and-forget)
    sendVetNotificationEmail({
      name: customer.name,
      email: customer.email,
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
    res.status(500).send({ message: err.message });
  }
};

// POST /vet/my-appointments/:id/cancel
const cancelMyAppointment = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const appointment = await VetAppointment.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!appointment) {
      return res.status(404).send({ message: "Cita no encontrada" });
    }

    if (["completed", "cancelled", "rejected", "no_show"].includes(appointment.status)) {
      return res
        .status(400)
        .send({ message: "Esta cita no puede ser cancelada" });
    }

    // Check cancellation time limit
    const hoursUntil =
      (new Date(appointment.date).getTime() - Date.now()) / 3600000;
    if (
      hoursUntil < config.cancellationHoursLimit &&
      appointment.status !== "requested"
    ) {
      return res.status(400).send({
        message: `Solo se puede cancelar con al menos ${config.cancellationHoursLimit} horas de anticipación`,
      });
    }

    appointment.status = "cancelled";
    appointment.cancelledBy = "customer";
    appointment.cancellationReason = req.body.reason || "";
    appointment.statusHistory.push({
      status: "cancelled",
      changedAt: new Date(),
      changedBy: "customer",
      note: req.body.reason || "Cancelada por el cliente",
    });

    await appointment.save();

    // Send cancellation email (fire-and-forget)
    await appointment.populate("customer", "name email");
    await appointment.populate("veterinarian", "name");
    await appointment.populate("customerPet", "name");
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
    res.status(500).send({ message: err.message });
  }
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

    const vet = await Veterinarian.findById(veterinarianId);
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
    let startHour, endHour;
    const vetSlot = (vet.availability || []).find(
      (s) => s.dayOfWeek === dayOfWeek
    );
    if (vetSlot) {
      startHour = vetSlot.start;
      endHour = vetSlot.end;
    } else {
      startHour = config.workingHours.start;
      endHour = config.workingHours.end;
    }

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

    const existingAppointments = await VetAppointment.find({
      veterinarian: veterinarianId,
      date: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled", "rejected", "no_show"] },
    }).select("date duration");

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
    res.status(500).send({ message: err.message });
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

    const vet = await Veterinarian.findById(veterinarianId);
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

    const existingAppointments = await VetAppointment.find({
      veterinarian: veterinarianId,
      date: { $gte: monthStart, $lte: monthEnd },
      status: { $nin: ["cancelled", "rejected", "no_show"] },
    }).select("date duration");

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
      let startHour, endHour;
      const vetSlot = (vet.availability || []).find(
        (s) => s.dayOfWeek === dayOfWeek
      );
      if (vetSlot) {
        startHour = vetSlot.start;
        endHour = vetSlot.end;
      } else {
        startHour = config.workingHours.start;
        endHour = config.workingHours.end;
      }

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
    res.status(500).send({ message: err.message });
  }
};

// GET /vet/my-price-info — Get pricing info for current customer
const getMyPriceInfo = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.enabled) {
      return res.status(200).send({ enabled: false });
    }

    const customer = await Customer.findById(req.user._id);
    const totalSpent = customer?.loyalty?.totalSpent || 0;
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
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// ADMIN APPOINTMENT ENDPOINTS
// ==========================================

// GET /vet/admin/appointments
const getAllAppointments = async (req, res) => {
  try {
    const { status, veterinarianId, page = 1, limit = 20, sortBy = "date" } = req.query;
    const pages = Number(page);
    const limits = Number(limit);

    const filter = {};
    if (status) filter.status = status;
    if (veterinarianId) filter.veterinarian = veterinarianId;

    const appointments = await VetAppointment.find(filter)
      .populate("customer", "name email phone loyalty")
      .populate("veterinarian", "name email specialties")
      .populate("customerPet", "name species breed")
      .sort({ [sortBy]: -1 })
      .skip((pages - 1) * limits)
      .limit(limits);

    const totalDoc = await VetAppointment.countDocuments(filter);

    res.status(200).send({ appointments, totalDoc, limits, pages });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /vet/admin/appointments/:id
const getAppointmentAdmin = async (req, res) => {
  try {
    const appointment = await VetAppointment.findById(req.params.id)
      .populate("customer", "name email phone loyalty")
      .populate("veterinarian", "name email specialties phone")
      .populate("customerPet", "name species breed age weight gender image notes");

    if (!appointment) {
      return res.status(404).send({ message: "Cita no encontrada" });
    }

    res.status(200).send(appointment);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// PATCH /vet/admin/appointments/:id/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, note, rejectionReason } = req.body;
    const config = await getOrCreateConfig();

    const appointment = await VetAppointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).send({ message: "Cita no encontrada" });
    }

    const validTransitions = {
      requested: ["approved", "rejected"],
      approved: ["confirmed", "cancelled"],
      confirmed: ["in_progress", "cancelled", "no_show"],
      in_progress: ["completed"],
    };

    const allowed = validTransitions[appointment.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).send({
        message: `No se puede cambiar de '${appointment.status}' a '${status}'`,
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

    appointment.status = status;
    appointment.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: "admin",
      note: (status === "rejected" ? (req.body.rejectionReason || note) : note) || "",
    });

    // Generate meeting URL when approving
    if (status === "approved" && !appointment.meetingUrl) {
      if (config.videoPlatform === "jitsi") {
        appointment.meetingUrl = generateJitsiUrl(appointment._id);
      }
      // Google Meet integration would go here
    }

    if (status === "cancelled") {
      appointment.cancelledBy = "admin";
      appointment.cancellationReason = note || "Cancelada por administración";
    }

    if (status === "rejected") {
      appointment.cancellationReason = req.body.rejectionReason || note || "";
    }

    if (req.body.adminNotes !== undefined) {
      appointment.adminNotes = req.body.adminNotes;
    }

    await appointment.save();

    await appointment.populate("customer", "name email");
    await appointment.populate("veterinarian", "name");
    await appointment.populate("customerPet", "name species");

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
    res.status(500).send({ message: err.message });
  }
};

// PUT /vet/admin/appointments/:id/notes
const updateAppointmentNotes = async (req, res) => {
  try {
    const appointment = await VetAppointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).send({ message: "Cita no encontrada" });
    }

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

    if (clinicalNotes !== undefined) appointment.clinicalNotes = clinicalNotes;
    if (diagnosis !== undefined) appointment.diagnosis = diagnosis;
    if (recommendations !== undefined)
      appointment.recommendations = recommendations;
    if (adminNotes !== undefined) appointment.adminNotes = adminNotes;

    await appointment.save();
    res.status(200).send({ message: "Notas actualizadas", appointment });
  } catch (err) {
    res.status(500).send({ message: err.message });
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
        VetAppointment.countDocuments(),
        VetAppointment.countDocuments({
          date: { $gte: today, $lt: tomorrow },
          status: { $nin: ["cancelled", "rejected"] },
        }),
        VetAppointment.countDocuments({ status: "requested" }),
        VetAppointment.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

    const statusMap = {};
    statusCounts.forEach((s) => {
      statusMap[s._id] = s.count;
    });

    res.status(200).send({
      totalAppointments,
      todayAppointments,
      pendingRequests,
      statusBreakdown: statusMap,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// GET /vet/admin/pets/:customerId — Get customer's pets (admin view)
const getCustomerPetsAdmin = async (req, res) => {
  try {
    const pets = await CustomerPet.find({
      customer: req.params.customerId,
    }).sort({ createdAt: -1 });

    res.status(200).send(pets);
  } catch (err) {
    res.status(500).send({ message: err.message });
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
