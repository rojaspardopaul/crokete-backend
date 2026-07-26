const express = require("express");
const router = express.Router();
const { isAdmin } = require("../config/auth");
const {
  getAllNotification,
  addNotification,
  updateStatusNotification,
  deleteNotificationById,
  deleteNotificationByProductId,
  deleteManyNotification,
  updateManyStatusNotification,
} = require("../controller/notificationController");

// Montado bajo isAuth en api/index.js. Sólo el alta queda abierta a clientes:
// la tienda crea una notificación al completar el pedido (useCheckoutSubmit).
// Todo lo demás es el buzón del panel — leerlo enseñaba los pedidos de otros
// clientes a cualquier usuario con sesión, y borrarlo estaba igual de abierto.

// add a notification on database
router.post("/add", addNotification);

// get all notification
router.get("/", isAdmin, getAllNotification);

// update notification status
router.put("/:id", isAdmin, updateStatusNotification);

// update many
router.patch("/update/many", isAdmin, updateManyStatusNotification);

// delete notification by id
router.delete("/:id", isAdmin, deleteNotificationById);

// delete notification by product id
router.delete("/product-id/:id", isAdmin, deleteNotificationByProductId);

// delete many
router.patch("/delete/many", isAdmin, deleteManyNotification);

module.exports = router;
