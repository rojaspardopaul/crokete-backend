const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");

const {
  getVetConfig,
  updateVetConfig,
} = require("../controller/vetConfigController");

const {
  getActiveVeterinarians,
  getAllVeterinarians,
  getVeterinarian,
  createVeterinarian,
  updateVeterinarian,
  deleteVeterinarian,
  toggleVeterinarianStatus,
} = require("../controller/veterinarianController");

const {
  getMyPets,
  createMyPet,
  updateMyPet,
  deleteMyPet,
  getMyAppointments,
  getMyAppointment,
  requestAppointment,
  cancelMyAppointment,
  getAvailableSlots,
  getAvailableDates,
  getMyPriceInfo,
  getAllAppointments,
  getAppointmentAdmin,
  updateAppointmentStatus,
  updateAppointmentNotes,
  getVetStats,
  getCustomerPetsAdmin,
} = require("../controller/vetAppointmentController");

// ==========================================
// CUSTOMER ENDPOINTS (isAuth applied at API registration)
// ==========================================

// Customer pets
router.get("/my-pets", getMyPets);
router.post("/my-pets", createMyPet);
router.put("/my-pets/:id", updateMyPet);
router.delete("/my-pets/:id", deleteMyPet);

// Customer appointments
router.get("/my-appointments", getMyAppointments);
router.get("/my-appointments/:id", getMyAppointment);
router.post("/appointments", requestAppointment);
router.post("/my-appointments/:id/cancel", cancelMyAppointment);

// Customer queries
router.get("/available-slots", getAvailableSlots);
router.get("/available-dates", getAvailableDates);
router.get("/my-price-info", getMyPriceInfo);

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// Config
router.get("/config", isAdmin, getVetConfig);
router.put("/config", isAdmin, updateVetConfig);

// Veterinarians management
router.get("/veterinarians", isAdmin, getAllVeterinarians);
router.get("/veterinarians/:id", isAdmin, getVeterinarian);
router.post("/veterinarians", isAdmin, createVeterinarian);
router.put("/veterinarians/:id", isAdmin, updateVeterinarian);
router.delete("/veterinarians/:id", isAdmin, deleteVeterinarian);
router.patch("/veterinarians/:id/status", isAdmin, toggleVeterinarianStatus);

// Appointment management
router.get("/admin/appointments", isAdmin, getAllAppointments);
router.get("/admin/appointments/:id", isAdmin, getAppointmentAdmin);
router.patch("/admin/appointments/:id/status", isAdmin, updateAppointmentStatus);
router.put("/admin/appointments/:id/notes", isAdmin, updateAppointmentNotes);
router.get("/admin/stats", isAdmin, getVetStats);
router.get("/admin/pets/:customerId", isAdmin, getCustomerPetsAdmin);

module.exports = router;
