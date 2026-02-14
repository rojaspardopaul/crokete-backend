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
  getMyProfile,
  updateMyProfile,
} = require("../controller/adminController");

const { passwordVerificationLimit } = require("../lib/email-sender/sender");
const { isAuth, isSuperAdmin } = require("../config/auth");
const { loginRateLimiter } = require("../lib/security/rateLimiter");

/**
 * Admin Authentication (Public routes)
 */
// Admin login
router.post("/login", loginRateLimiter, loginAdmin);
// Forget password
router.put("/forget-password", passwordVerificationLimit, forgetPassword);
// Reset password
router.put("/reset-password", resetPassword);

/**
 * Current Admin Profile (Protected - Any authenticated admin)
 */
// Get own profile
router.get("/me", isAuth, getMyProfile);
// Update own profile
router.put("/me", isAuth, updateMyProfile);

/**
 * Staff Management (Protected routes - Super Admin only)
 */
// Add a staff
router.post("/add", isAuth, isSuperAdmin, addStaff);
// Get all staff
router.get("/", isAuth, isSuperAdmin, getAllStaff);
// Get a single staff by ID (changed to GET from POST)
router.get("/:id", isAuth, isSuperAdmin, getStaffById);
// Update a staff by ID
router.put("/:id", isAuth, isSuperAdmin, updateStaff);
// Update staff status by ID
router.put("/update-status/:id", isAuth, isSuperAdmin, updatedStatus);
// Delete a staff by ID
router.delete("/:id", isAuth, isSuperAdmin, deleteStaff);

module.exports = router;
