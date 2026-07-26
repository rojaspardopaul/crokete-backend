const express = require("express");
const router = express.Router();
const {
  loginCustomer,
  refreshToken,
  registerCustomer,
  verifyPhoneNumber,
  signUpWithOauthProvider,
  verifyEmailAddress,
  forgetPassword,
  changePassword,
  resetPassword,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  addAllCustomers,
  addShippingAddress,
  getShippingAddress,
  updateShippingAddress,
  deleteShippingAddress,
} = require("../controller/customerController");
const {
  passwordVerificationLimit,
  emailVerificationLimit,
  phoneVerificationLimit,
} = require("../lib/email-sender/sender");
const { loginRateLimiter } = require("../lib/security/apiRateLimiter");
// Bloqueo por cuenta (5 fallos → 30 min), el mismo que ya protegía al panel.
// El limitador de arriba es sólo por IP, así que por sí solo no frena un ataque
// repartido entre varias direcciones contra una misma cuenta.
const { loginRateLimiter: accountLockout } = require("../lib/security/rateLimiter");
const { isAuth, isSuperAdmin } = require("../config/auth");

//verify email
router.post("/verify-email", emailVerificationLimit, verifyEmailAddress);

//verify phone number
router.post("/verify-phone", phoneVerificationLimit, verifyPhoneNumber);

// shipping address send to array
router.post("/shipping/address/:id", isAuth, addShippingAddress);

// get all shipping address
router.get("/shipping/address/:id", isAuth, getShippingAddress);

// shipping address update
router.put("/shipping/address/:userId/:shippingId", isAuth, updateShippingAddress);

// shipping address delete
router.delete("/shipping/address/:userId/:shippingId", isAuth, deleteShippingAddress);

//register a user
router.post("/register/:token", loginRateLimiter, registerCustomer);

//login a user
router.post("/login", loginRateLimiter, accountLockout, loginCustomer);

// refresh token
router.post("/refresh", refreshToken);

//register or login with google and fb
router.post("/signup/oauth", loginRateLimiter, signUpWithOauthProvider);

//forget-password
router.put("/forget-password", passwordVerificationLimit, forgetPassword);

//reset-password
router.put("/reset-password", resetPassword);

//change password — requiere auth para evitar cambiar contraseña de otro usuario
router.post("/change-password", isAuth, changePassword);

//add all users — solo super admin (operación destructiva)
router.post("/add/all", isAuth, isSuperAdmin, addAllCustomers);

//get all user — solo admin
router.get("/", isAuth, isSuperAdmin, getAllCustomers);

//get a user — requiere auth; el controlador valida que sea el propio usuario o admin
router.get("/:id", isAuth, getCustomerById);

//update a user
router.put("/:id", isAuth, updateCustomer);

//delete a user — solo admin
router.delete("/:id", isAuth, isSuperAdmin, deleteCustomer);

module.exports = router;
