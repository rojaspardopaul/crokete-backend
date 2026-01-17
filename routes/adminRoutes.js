const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  forgetPassword,
  resetPassword,
  addStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  updatedStatus,
} = require("../controller/adminController");

const { passwordVerificationLimit } = require("../lib/email-sender/sender");

/**
 * Admin Authentication
 */
// Register admin/staff
router.post("/register", registerAdmin);
// Admin login
router.post("/login", loginAdmin);
// Forget password
router.put("/forget-password", passwordVerificationLimit, forgetPassword);
// Reset password
router.put("/reset-password", resetPassword);

/**
 * Staff Management
 */
// Add a staff
router.post("/add", addStaff);
// Get all staff
router.get("/", getAllStaff);
// Get a single staff by ID (changed to GET from POST)
router.get("/:id", getStaffById);
// Update a staff by ID
router.put("/:id", updateStaff);
// Update staff status by ID
router.put("/update-status/:id", updatedStatus);
// Delete a staff by ID
router.delete("/:id", deleteStaff);

module.exports = router;
