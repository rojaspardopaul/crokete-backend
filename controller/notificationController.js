const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail } = require("../lib/prisma/helpers");

const notifications = () => getPrisma().notification;

/**
 * Las notificaciones referencian pedido, producto y administrador por clave
 * foránea: un id que no sea uuid (o que ya no exista) haría fallar la inserción,
 * así que se guarda la notificación sin ese vínculo.
 */
const relationOrNull = (value) => (isUuid(value) ? value : null);

const addNotification = async (req, res) => {
  try {
    const { productId, orderId, adminId, message, image, status } = req.body;

    // Una sola notificación por producto (aviso de stock bajo): si ya existe,
    // no se crea otra.
    if (productId) {
      const isAdded = await notifications().findFirst({
        where: { productId: relationOrNull(productId) },
      });
      if (isAdded) {
        return res.end();
      }
    }

    await notifications().create({
      data: {
        productId: relationOrNull(productId),
        orderId: relationOrNull(orderId),
        adminId: relationOrNull(adminId),
        message: message || "",
        image: image || null,
        status: status === "read" ? "read" : "unread",
      },
    });

    res.status(200).send({
      message: "¡Notificación guardada correctamente!",
    });
  } catch (err) {
    fail(res, err);
  }
};

const getAllNotification = async (req, res) => {
  try {
    const { page } = req.query;

    const pages = Number(page) || 1;
    const limits = 5;
    const skip = (pages - 1) * limits;

    const [totalDoc, totalUnreadDoc, rows] = await Promise.all([
      notifications().count(),
      notifications().count({ where: { status: "unread" } }),
      notifications().findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limits,
      }),
    ]);

    res.send({ totalDoc, totalUnreadDoc, notifications: rows.map(toApi) });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatusNotification = async (req, res) => {
  try {
    const newStatus = req.body.status === "read" ? "read" : "unread";

    if (isUuid(req.params.id)) {
      await notifications().updateMany({
        where: { id: req.params.id },
        data: { status: newStatus },
      });
    }
    const totalDoc = await notifications().count({ where: { status: "unread" } });

    res.send({
      totalDoc,
      message: `Notification Read!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyStatusNotification = async (req, res) => {
  try {
    await notifications().updateMany({
      where: { id: { in: uuidList(req.body.ids) } },
      data: { status: req.body.status === "read" ? "read" : "unread" },
    });

    res.send({
      message: "¡Notificación actualizada correctamente!",
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteNotificationById = async (req, res) => {
  try {
    if (isUuid(req.params.id)) {
      await notifications().deleteMany({ where: { id: req.params.id } });
    }
    res.send({
      message: "¡Notificación eliminada correctamente!",
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteNotificationByProductId = async (req, res) => {
  try {
    if (isUuid(req.params.id)) {
      await notifications().deleteMany({ where: { productId: req.params.id } });
    }
    res.send({
      message: "¡Notificación eliminada correctamente!",
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyNotification = async (req, res) => {
  try {
    await notifications().deleteMany({
      where: { id: { in: uuidList(req.body.ids) } },
    });

    res.send({
      message: `¡Notificación eliminada correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  getAllNotification,
  addNotification,
  updateStatusNotification,
  deleteNotificationById,
  deleteNotificationByProductId,
  updateManyStatusNotification,
  deleteManyNotification,
};
