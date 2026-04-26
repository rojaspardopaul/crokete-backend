const express = require("express");
const router = express.Router();
const {
  getAllOrders,
  getOrderById,
  getOrderCustomer,
  updateOrder,
  deleteOrder,
  getDashboardOrders,
  getDashboardRecentOrder,
  getBestSellerProductChart,
  getDashboardCount,
  getDashboardAmount,
} = require("../controller/orderController");
const { isAdmin } = require("../config/auth");

// Todas estas rutas están bajo isAuth en api/index.js
// Adicionalmente requieren isAdmin — solo el panel de administración accede aquí

router.get("/", isAdmin, getAllOrders);
router.get("/dashboard", isAdmin, getDashboardOrders);
router.get("/dashboard-recent-order", isAdmin, getDashboardRecentOrder);
router.get("/dashboard-count", isAdmin, getDashboardCount);
router.get("/dashboard-amount", isAdmin, getDashboardAmount);
router.get("/best-seller/chart", isAdmin, getBestSellerProductChart);
router.get("/customer/:id", isAdmin, getOrderCustomer);
router.get("/:id", isAdmin, getOrderById);
router.put("/:id", isAdmin, updateOrder);
router.delete("/:id", isAdmin, deleteOrder);

module.exports = router;
