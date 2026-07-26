const { getPrisma } = require("../lib/prisma");
const { orderToApi, toApi, num } = require("../lib/prisma/presenters");
const { isUuid, fail, notFound } = require("../lib/prisma/helpers");
const { applyStatusChangeEffects } = require("../lib/orders/statusChangeEffects");

const orders = () => getPrisma().order;

/** Estados válidos del pedido (el enum de Postgres los rechaza si no coinciden). */
const STATUSES = ["pedido", "empaquetado", "en_reparto", "entregado", "cancelado"];

/**
 * Columnas del listado del panel. `items` no se incluye: la tabla de pedidos
 * sólo muestra folio, cliente e importes, y traer el carrito completo de cada
 * fila multiplicaría el peso de la respuesta.
 */
const LIST_SELECT = {
  id: true,
  invoice: true,
  paymentMethod: true,
  subTotal: true,
  total: true,
  userInfo: true,
  discount: true,
  shippingCost: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

/** El listado devuelve `user_info`, no `userInfo`. */
const listRowToApi = (row) => {
  const { userInfo, ...rest } = row;
  return { ...toApi(rest), user_info: userInfo };
};

/** `take` sólo se aplica con un límite numérico positivo, como hacía Mongoose. */
const paginate = (page, limit, fallbackLimit) => {
  const pages = Number(page) || 1;
  const limits = Number(limit) || fallbackLimit;
  const take = Number.isFinite(limits) && limits > 0 ? limits : undefined;
  const skip = take ? (pages - 1) * take : 0;
  return { pages, limits, take, skip };
};

const getAllOrders = async (req, res) => {
  const { day, status, page, limit, method, endDate, startDate, customerName } =
    req.query;

  const where = {};

  if (status) {
    // Mongo aceptaba cualquier texto como expresión regular; el enum de
    // Postgres no, así que un estado desconocido simplemente no filtra nada.
    const normalized = String(status).trim().toLowerCase();
    if (STATUSES.includes(normalized)) where.status = normalized;
  }

  if (customerName) {
    const term = String(customerName).trim();
    const asInvoice = Number(term);
    where.OR = [
      // `user_info` es jsonb: se busca dentro de la clave `name`.
      { userInfo: { path: ["name"], string_contains: term, mode: "insensitive" } },
      // El folio es numérico. En Mongo se comparaba con una expresión regular
      // contra un campo Number, que nunca casaba: buscar por folio no funcionaba.
      ...(Number.isInteger(asInvoice) ? [{ invoice: asInvoice }] : []),
    ];
  }

  if (day) {
    const from = new Date();
    from.setDate(from.getDate() - Number(day));
    where.createdAt = { gte: from, lte: new Date() };
  }

  if (startDate && endDate) {
    where.updatedAt = { gt: new Date(startDate), lt: new Date(endDate) };
  }

  if (method) {
    where.paymentMethod = { contains: String(method), mode: "insensitive" };
  }

  const { pages, limits, take, skip } = paginate(page, limit);

  try {
    const [totalDoc, rows] = await Promise.all([
      orders().count({ where }),
      orders().findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    let methodTotals = [];
    if (startDate && endDate) {
      // El total por método de pago lo agrupa la base; antes se recorría en
      // memoria todo el rango de fechas.
      const grouped = await orders().groupBy({
        by: ["paymentMethod"],
        where,
        _sum: { total: true },
      });
      methodTotals = grouped.map((g) => ({
        method: g.paymentMethod,
        total: num(g._sum.total),
      }));
    }

    res.send({
      orders: rows.map(listRowToApi),
      limits,
      pages,
      totalDoc,
      methodTotals,
    });
  } catch (err) {
    fail(res, err);
  }
};

const getOrderCustomer = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.send([]);
    const rows = await orders().findMany({
      where: { customerId: req.params.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(orderToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Pedido no encontrado");
    const order = await orders().findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) return notFound(res, "Pedido no encontrado");
    res.send(orderToApi(order));
  } catch (err) {
    fail(res, err);
  }
};

const updateOrder = async (req, res) => {
  try {
    const newStatus = req.body.status;
    if (!STATUSES.includes(newStatus)) {
      return res.status(400).send({ message: "Estado de pedido no válido" });
    }
    if (!isUuid(req.params.id)) {
      return notFound(res, "Pedido no encontrado");
    }

    // Get the current order to know previous status
    const current = await orders().findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!current) {
      return notFound(res, "Pedido no encontrado");
    }
    const previousStatus = current.status;

    await orders().update({
      where: { id: req.params.id },
      data: { status: newStatus },
    });

    // Side effects (loyalty coupon restore + points + status email). Extracted
    // to lib/orders/statusChangeEffects so the new TS orders module reuses the
    // exact same logic.
    await applyStatusChangeEffects(orderToApi(current), newStatus, previousStatus);

    res.status(200).send({
      message: "¡Pedido actualizado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Error al actualizar el pedido",
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return notFound(res, "Pedido no encontrado");
    }
    // Las líneas del pedido caen en cascada; los registros de pago y los
    // movimientos de puntos conservan su historia con la referencia en NULL.
    const deleted = await orders().deleteMany({ where: { id: req.params.id } });
    if (deleted.count === 0) {
      return notFound(res, "Pedido no encontrado");
    }

    res.status(200).send({
      message: "¡Pedido eliminado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Error al eliminar el pedido",
    });
  }
};

// get dashboard recent order
const getDashboardRecentOrder = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { take, skip } = paginate(page, limit, 8);

    const [totalDoc, rows] = await Promise.all([
      orders().count(),
      orders().findMany({
        include: { items: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    res.send({
      orders: rows.map(orderToApi),
      page: page,
      limit: limit,
      totalOrder: totalDoc,
    });
  } catch (err) {
    fail(res, err);
  }
};

/**
 * Suma e importe por estado. Mongo devolvía `[{ _id: null, total, count }]` y el
 * panel lee `.count` / `.total`, así que se conserva esa forma exacta.
 */
async function statusTotals(status) {
  const result = await orders().aggregate({
    where: { status },
    _sum: { total: true },
    _count: { _all: true },
  });
  const count = result._count._all;
  if (count === 0) return null;
  return { _id: null, total: num(result._sum.total), count };
}

// get dashboard count
const getDashboardCount = async (req, res) => {
  try {
    const [totalDoc, pending, processing, delivered] = await Promise.all([
      orders().count(),
      statusTotals("pedido"),
      statusTotals("empaquetado"),
      statusTotals("entregado"),
    ]);

    res.send({
      totalOrder: totalDoc,
      totalPendingOrder: pending || 0,
      totalProcessingOrder: processing?.count || 0,
      totalDeliveredOrder: delivered?.count || 0,
    });
  } catch (err) {
    fail(res, err);
  }
};

/** Suma de `total` de los pedidos entregados dentro de un rango de fechas. */
async function deliveredTotalBetween(gte, lt) {
  const result = await orders().aggregate({
    where: { status: "entregado", updatedAt: { gte, lt } },
    _sum: { total: true },
    _count: { _all: true },
  });
  return result._count._all === 0 ? undefined : num(result._sum.total);
}

const getDashboardAmount = async (req, res) => {
  let week = new Date();
  week.setDate(week.getDate() - 10);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  try {
    const [totalAgg, thisMonth, lastMonth, ordersData] = await Promise.all([
      orders().aggregate({ _sum: { total: true }, _count: { _all: true } }),
      deliveredTotalBetween(thisMonthStart, nextMonthStart),
      deliveredTotalBetween(lastMonthStart, thisMonthStart),
      // order list last 10 days
      orders().findMany({
        where: { status: "entregado", updatedAt: { gte: week } },
        select: {
          id: true,
          paymentMethod: true,
          total: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    res.send({
      totalAmount:
        totalAgg._count._all === 0
          ? 0
          : num(totalAgg._sum.total).toFixed(2),
      thisMonthlyOrderAmount: thisMonth,
      lastMonthOrderAmount: lastMonth,
      ordersData: ordersData.map(toApi),
    });
  } catch (err) {
    fail(res, err);
  }
};

const getBestSellerProductChart = async (req, res) => {
  try {
    const [totalDoc, grouped] = await Promise.all([
      orders().count(),
      // Equivale al $unwind + $group sobre `cart`: ahora cada línea es una fila.
      getPrisma().orderItem.groupBy({
        by: ["title"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 4,
      }),
    ]);

    res.send({
      totalDoc,
      bestSellingProduct: grouped.map((g) => ({
        _id: g.title,
        count: g._sum.quantity || 0,
      })),
    });
  } catch (err) {
    fail(res, err);
  }
};

const getDashboardOrders = async (req, res) => {
  const { page, limit } = req.query;
  const { take, skip } = paginate(page, limit, 8);

  let week = new Date();
  week.setDate(week.getDate() - 10);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const [
      totalDoc,
      rows,
      totalAgg,
      todayOrder,
      pending,
      processing,
      delivered,
      weeklySaleReport,
      latest,
    ] = await Promise.all([
      orders().count(),
      orders().findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      orders().aggregate({ _sum: { total: true }, _count: { _all: true } }),
      // El panel sólo suma `total` y agrupa por fecha/estado en estas dos
      // listas, así que van sin el carrito (`cart` sale vacío).
      orders().findMany({ where: { createdAt: { gte: startOfToday } } }),
      statusTotals("pedido"),
      statusTotals("empaquetado"),
      statusTotals("entregado"),
      orders().findMany({
        where: { status: "entregado", createdAt: { gte: week } },
      }),
      // El total "de este mes" en Mongo era el del mes más reciente CON pedidos,
      // no necesariamente el mes en curso; se conserva ese criterio.
      orders().findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    let totalAmountOfThisMonth = 0;
    if (latest) {
      const from = new Date(latest.createdAt.getFullYear(), latest.createdAt.getMonth(), 1);
      const to = new Date(latest.createdAt.getFullYear(), latest.createdAt.getMonth() + 1, 1);
      const monthAgg = await orders().aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { total: true },
      });
      totalAmountOfThisMonth = num(monthAgg._sum.total).toFixed(2);
    }

    res.send({
      totalOrder: totalDoc,
      totalAmount:
        totalAgg._count._all === 0 ? 0 : num(totalAgg._sum.total).toFixed(2),
      todayOrder: todayOrder.map(orderToApi),
      totalAmountOfThisMonth,
      totalPendingOrder: pending || 0,
      totalProcessingOrder: processing?.count || 0,
      totalDeliveredOrder: delivered?.count || 0,
      orders: rows.map(orderToApi),
      weeklySaleReport: weeklySaleReport.map(orderToApi),
    });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  getOrderCustomer,
  updateOrder,
  deleteOrder,
  getBestSellerProductChart,
  getDashboardOrders,
  getDashboardRecentOrder,
  getDashboardCount,
  getDashboardAmount,
};
