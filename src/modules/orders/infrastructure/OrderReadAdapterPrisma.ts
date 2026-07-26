import type { OrderReadPort, ListOrdersQuery } from "../application/ports";
import { prisma, isUuid } from "../../../shared/prisma";
import { orderToApi, toApi, num } from "../../../shared/presenters";

type Row = Record<string, unknown>;

/** Estados válidos del pedido (el enum de Postgres rechaza cualquier otro). */
const STATUSES = ["pedido", "empaquetado", "en_reparto", "entregado", "cancelado"];

/**
 * Columnas del listado del panel: folio, cliente e importes. El carrito no se
 * incluye porque multiplicaría el peso de la respuesta sin que la tabla lo use.
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
} as const;

/** El listado devuelve `user_info`, no `userInfo`. */
function listRowToApi(row: Row): Row {
  const { userInfo, ...rest } = row;
  return { ...toApi(rest), user_info: userInfo };
}

/** `take` sólo se aplica con un límite numérico positivo. */
function paginate(page?: number | string, limit?: number | string, fallback?: number) {
  const pages = Number(page) || 1;
  const limits = Number(limit) || (fallback as number);
  const take = Number.isFinite(limits) && limits > 0 ? limits : undefined;
  const skip = take ? (pages - 1) * take : 0;
  return { pages, limits, take, skip };
}

/**
 * Read model for admin order queries and dashboards. Devuelve exactamente las
 * mismas formas que el controlador heredado, que es contra lo que está escrito
 * el panel (y lo que fijan los tests de paridad).
 */
export class OrderReadAdapterPrisma implements OrderReadPort {
  async getAllOrders(query: ListOrdersQuery): Promise<unknown> {
    const { day, status, page, limit, method, endDate, startDate, customerName } = query;

    const where: Row = {};

    if (status) {
      // Mongo aceptaba cualquier texto como expresión regular; el enum de
      // Postgres no, así que un estado desconocido no filtra nada.
      const normalized = String(status).trim().toLowerCase();
      if (STATUSES.includes(normalized)) where.status = normalized;
    }

    if (customerName) {
      const term = String(customerName).trim();
      const asInvoice = Number(term);
      where.OR = [
        { userInfo: { path: ["name"], string_contains: term, mode: "insensitive" } },
        // El folio es numérico: en Mongo se comparaba con una expresión regular
        // contra un campo Number y nunca casaba.
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

    const [totalDoc, rows] = await Promise.all([
      prisma().order.count({ where: where as never }),
      prisma().order.findMany({
        where: where as never,
        select: LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    let methodTotals: { method: string; total: number }[] = [];
    if (startDate && endDate) {
      const grouped = await prisma().order.groupBy({
        by: ["paymentMethod"],
        where: where as never,
        _sum: { total: true },
      });
      methodTotals = grouped.map((g) => ({
        method: g.paymentMethod,
        total: num(g._sum.total),
      }));
    }

    return {
      orders: rows.map((r) => listRowToApi(r as Row)),
      limits,
      pages,
      totalDoc,
      methodTotals,
    };
  }

  async getOrderById(id: string): Promise<unknown> {
    if (!isUuid(id)) return null;
    const row = await prisma().order.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? orderToApi(row as Row) : null;
  }

  async getOrderCustomer(customerId: string): Promise<unknown> {
    if (!isUuid(customerId)) return [];
    const rows = await prisma().order.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => orderToApi(r as Row));
  }

  async getDashboardRecentOrder(query: { page?: number; limit?: number }): Promise<unknown> {
    const { take, skip } = paginate(query.page, query.limit, 8);

    const [totalDoc, rows] = await Promise.all([
      prisma().order.count(),
      prisma().order.findMany({
        include: { items: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    return {
      orders: rows.map((r) => orderToApi(r as Row)),
      page: query.page,
      limit: query.limit,
      totalOrder: totalDoc,
    };
  }

  /**
   * Suma e importe por estado. Mongo devolvía `[{ _id: null, total, count }]` y
   * el panel lee `.count` / `.total`, así que se conserva esa forma.
   */
  private async statusTotals(
    status: string
  ): Promise<{ _id: null; total: number; count: number } | null> {
    const result = await prisma().order.aggregate({
      where: { status: status as never },
      _sum: { total: true },
      _count: { _all: true },
    });
    const count = result._count._all;
    if (count === 0) return null;
    return { _id: null, total: num(result._sum.total), count };
  }

  async getDashboardCount(): Promise<unknown> {
    const [totalDoc, pending, processing, delivered] = await Promise.all([
      prisma().order.count(),
      this.statusTotals("pedido"),
      this.statusTotals("empaquetado"),
      this.statusTotals("entregado"),
    ]);

    return {
      totalOrder: totalDoc,
      totalPendingOrder: pending || 0,
      totalProcessingOrder: processing?.count || 0,
      totalDeliveredOrder: delivered?.count || 0,
    };
  }

  /** Suma de `total` de los pedidos entregados dentro de un rango de fechas. */
  private async deliveredTotalBetween(gte: Date, lt: Date): Promise<number | undefined> {
    const result = await prisma().order.aggregate({
      where: { status: "entregado", updatedAt: { gte, lt } },
      _sum: { total: true },
      _count: { _all: true },
    });
    return result._count._all === 0 ? undefined : num(result._sum.total);
  }

  async getDashboardAmount(): Promise<unknown> {
    const week = new Date();
    week.setDate(week.getDate() - 10);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalAgg, thisMonth, lastMonth, ordersData] = await Promise.all([
      prisma().order.aggregate({ _sum: { total: true }, _count: { _all: true } }),
      this.deliveredTotalBetween(thisMonthStart, nextMonthStart),
      this.deliveredTotalBetween(lastMonthStart, thisMonthStart),
      prisma().order.findMany({
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

    return {
      totalAmount:
        totalAgg._count._all === 0 ? 0 : num(totalAgg._sum.total).toFixed(2),
      thisMonthlyOrderAmount: thisMonth,
      lastMonthOrderAmount: lastMonth,
      ordersData: ordersData.map((o) => toApi(o)),
    };
  }

  async getBestSellerProductChart(): Promise<unknown> {
    const [totalDoc, grouped] = await Promise.all([
      prisma().order.count(),
      // Equivale al $unwind + $group sobre `cart`: ahora cada línea es una fila.
      prisma().orderItem.groupBy({
        by: ["title"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 4,
      }),
    ]);

    return {
      totalDoc,
      bestSellingProduct: grouped.map((g) => ({
        _id: g.title,
        count: g._sum.quantity || 0,
      })),
    };
  }

  async getDashboardOrders(query: { page?: number; limit?: number }): Promise<unknown> {
    const { take, skip } = paginate(query.page, query.limit, 8);

    const week = new Date();
    week.setDate(week.getDate() - 10);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

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
      prisma().order.count(),
      prisma().order.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma().order.aggregate({ _sum: { total: true }, _count: { _all: true } }),
      // El panel sólo suma `total` y agrupa por fecha/estado en estas dos
      // listas, así que van sin el carrito (`cart` sale vacío).
      prisma().order.findMany({ where: { createdAt: { gte: startOfToday } } }),
      this.statusTotals("pedido"),
      this.statusTotals("empaquetado"),
      this.statusTotals("entregado"),
      prisma().order.findMany({
        where: { status: "entregado", createdAt: { gte: week } },
      }),
      // El total "de este mes" en Mongo era el del mes más reciente CON pedidos,
      // no necesariamente el mes en curso; se conserva ese criterio.
      prisma().order.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    let totalAmountOfThisMonth: string | number = 0;
    if (latest) {
      const from = new Date(latest.createdAt.getFullYear(), latest.createdAt.getMonth(), 1);
      const to = new Date(latest.createdAt.getFullYear(), latest.createdAt.getMonth() + 1, 1);
      const monthAgg = await prisma().order.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { total: true },
      });
      totalAmountOfThisMonth = num(monthAgg._sum.total).toFixed(2);
    }

    return {
      totalOrder: totalDoc,
      totalAmount:
        totalAgg._count._all === 0 ? 0 : num(totalAgg._sum.total).toFixed(2),
      todayOrder: todayOrder.map((o) => orderToApi(o as Row)),
      totalAmountOfThisMonth,
      totalPendingOrder: pending || 0,
      totalProcessingOrder: processing?.count || 0,
      totalDeliveredOrder: delivered?.count || 0,
      orders: rows.map((r) => orderToApi(r as Row)),
      weeklySaleReport: weeklySaleReport.map((o) => orderToApi(o as Row)),
    };
  }
}
