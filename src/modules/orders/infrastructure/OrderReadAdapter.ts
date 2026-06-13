import type { OrderReadPort, ListOrdersQuery } from "../application/ports";
import { OrderModel } from "./OrderModel";

/** Escapes regex metacharacters in user input (local copy, no legacy dep). */
function escapeRegex(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LIFECYCLE_OR = [
  { status: { $regex: `pedido`, $options: "i" } },
  { status: { $regex: `empaquetado`, $options: "i" } },
  { status: { $regex: `en_reparto`, $options: "i" } },
  { status: { $regex: `entregado`, $options: "i" } },
  { status: { $regex: `cancelado`, $options: "i" } },
];

/**
 * Read model for admin order queries and dashboards. Faithful TypeScript port
 * of the read/aggregation logic in the legacy orderController.js, so responses
 * keep the same shape the admin dashboard expects.
 */
export class OrderReadAdapter implements OrderReadPort {
  async getAllOrders(query: ListOrdersQuery): Promise<unknown> {
    const { day, status, page, limit, method, endDate, startDate, customerName } = query;

    const date = new Date();
    const today = date.toString();
    date.setDate(date.getDate() - Number(day));
    const dateTime = date.toString();

    const startDateData = new Date(startDate as string);
    const start_date = startDateData.toString();

    const queryObject: Record<string, unknown> = {};
    if (!status) queryObject.$or = LIFECYCLE_OR;
    if (customerName) {
      queryObject.$or = [
        { "user_info.name": { $regex: escapeRegex(customerName), $options: "i" } },
        { invoice: { $regex: escapeRegex(customerName), $options: "i" } },
      ];
    }
    if (day) queryObject.createdAt = { $gte: dateTime, $lte: today };
    if (status) queryObject.status = { $regex: escapeRegex(status), $options: "i" };
    if (startDate && endDate) queryObject.updatedAt = { $gt: start_date, $lt: endDate };
    if (method) queryObject.paymentMethod = { $regex: escapeRegex(method), $options: "i" };

    const pages = Number(page) || 1;
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    const totalDoc = await OrderModel.countDocuments(queryObject);
    const orders = await OrderModel.find(queryObject)
      .select(
        "_id invoice paymentMethod subTotal total user_info discount shippingCost status createdAt updatedAt"
      )
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limits);

    const methodTotals: { method: string; total: number }[] = [];
    if (startDate && endDate) {
      const filteredOrders = await OrderModel.find(queryObject, {
        _id: 1,
        total: 1,
        paymentMethod: 1,
        updatedAt: 1,
      }).sort({ updatedAt: -1 });
      for (const order of filteredOrders) {
        const paymentMethod = order.paymentMethod as string;
        const total = order.total as number;
        const exist = methodTotals.find((i) => i.method === paymentMethod);
        if (exist) exist.total += total;
        else methodTotals.push({ method: paymentMethod, total });
      }
    }

    return { orders, limits, pages, totalDoc, methodTotals };
  }

  async getOrderById(id: string): Promise<unknown> {
    return OrderModel.findById(id);
  }

  async getOrderCustomer(customerId: string): Promise<unknown> {
    return OrderModel.find({ user: customerId }).sort({ _id: -1 });
  }

  async getDashboardRecentOrder(query: { page?: number; limit?: number }): Promise<unknown> {
    const pages = Number(query.page) || 1;
    const limits = Number(query.limit) || 8;
    const skip = (pages - 1) * limits;

    const queryObject = { $or: LIFECYCLE_OR };
    const totalDoc = await OrderModel.countDocuments(queryObject);
    const orders = await OrderModel.find(queryObject)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limits);

    return { orders, page: query.page, limit: query.limit, totalOrder: totalDoc };
  }

  async getDashboardCount(): Promise<unknown> {
    const totalDoc = await OrderModel.countDocuments();
    const [totalPendingOrder, totalProcessingOrder, totalDeliveredOrder] = await Promise.all([
      OrderModel.aggregate([
        { $match: { status: "pedido" } },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate([
        { $match: { status: "empaquetado" } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate([
        { $match: { status: "entregado" } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalOrder: totalDoc,
      totalPendingOrder: totalPendingOrder[0] || 0,
      totalProcessingOrder: totalProcessingOrder[0]?.count || 0,
      totalDeliveredOrder: totalDeliveredOrder[0]?.count || 0,
    };
  }

  async getDashboardAmount(): Promise<unknown> {
    const week = new Date();
    week.setDate(week.getDate() - 10);

    const currentDate = new Date();
    currentDate.setDate(1);
    currentDate.setHours(0, 0, 0, 0);
    const lastMonthStartDate = new Date(currentDate);
    lastMonthStartDate.setMonth(currentDate.getMonth() - 1);
    const lastMonthEndDate = new Date(currentDate);
    lastMonthEndDate.setDate(0);
    lastMonthEndDate.setHours(23, 59, 59, 999);

    const monthProject = {
      $project: {
        year: { $year: "$updatedAt" },
        month: { $month: "$updatedAt" },
        total: 1,
        subTotal: 1,
        discount: 1,
        updatedAt: 1,
        createdAt: 1,
        status: 1,
      },
    };
    const monthGroup = {
      $group: {
        _id: { month: { $month: "$updatedAt" } },
        total: { $sum: "$total" },
        subTotal: { $sum: "$subTotal" },
        discount: { $sum: "$discount" },
      },
    };

    const [totalAmount, thisMonthOrderAmount, lastMonthOrderAmount, orderFilteringData] =
      await Promise.all([
        OrderModel.aggregate([{ $group: { _id: null, tAmount: { $sum: "$total" } } }]),
        OrderModel.aggregate([
          monthProject,
          {
            $match: {
              status: { $regex: "entregado", $options: "i" },
              year: { $eq: new Date().getFullYear() },
              month: { $eq: new Date().getMonth() + 1 },
            },
          },
          monthGroup,
          { $sort: { _id: -1 } },
          { $limit: 1 },
        ]),
        OrderModel.aggregate([
          monthProject,
          {
            $match: {
              status: { $regex: "entregado", $options: "i" },
              updatedAt: { $gt: lastMonthStartDate, $lt: lastMonthEndDate },
            },
          },
          monthGroup,
          { $sort: { _id: -1 } },
          { $limit: 1 },
        ]),
        OrderModel.find(
          { status: { $regex: `entregado`, $options: "i" }, updatedAt: { $gte: week } },
          { paymentMethod: 1, paymentDetails: 1, total: 1, createdAt: 1, updatedAt: 1 }
        ),
      ]);

    return {
      totalAmount:
        totalAmount.length === 0 ? 0 : parseFloat(totalAmount[0].tAmount).toFixed(2),
      thisMonthlyOrderAmount: thisMonthOrderAmount[0]?.total,
      lastMonthOrderAmount: lastMonthOrderAmount[0]?.total,
      ordersData: orderFilteringData,
    };
  }

  async getBestSellerProductChart(): Promise<unknown> {
    const totalDoc = await OrderModel.countDocuments({});
    const bestSellingProduct = await OrderModel.aggregate([
      { $unwind: "$cart" },
      { $group: { _id: "$cart.title", count: { $sum: "$cart.quantity" } } },
      { $sort: { count: -1 } },
      { $limit: 4 },
    ]);
    return { totalDoc, bestSellingProduct };
  }

  async getDashboardOrders(query: { page?: number; limit?: number }): Promise<unknown> {
    const pages = Number(query.page) || 1;
    const limits = Number(query.limit) || 8;
    const skip = (pages - 1) * limits;

    const week = new Date();
    week.setDate(week.getDate() - 10);
    const start = new Date().toDateString();

    const totalDoc = await OrderModel.countDocuments({});
    const orders = await OrderModel.find({}).sort({ _id: -1 }).skip(skip).limit(limits);

    const [totalAmount, todayOrder, totalAmountOfThisMonth, totalPendingOrder, totalProcessingOrder, totalDeliveredOrder, weeklySaleReport] =
      await Promise.all([
        OrderModel.aggregate([{ $group: { _id: null, tAmount: { $sum: "$total" } } }]),
        OrderModel.find({ createdAt: { $gte: start } }),
        OrderModel.aggregate([
          {
            $group: {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              total: { $sum: "$total" },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 1 },
        ]),
        OrderModel.aggregate([
          { $match: { status: "pedido" } },
          { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
          { $match: { status: "empaquetado" } },
          { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
          { $match: { status: "entregado" } },
          { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
        ]),
        OrderModel.find({
          status: { $regex: `entregado`, $options: "i" },
          createdAt: { $gte: week },
        }),
      ]);

    return {
      totalOrder: totalDoc,
      totalAmount: totalAmount.length === 0 ? 0 : parseFloat(totalAmount[0].tAmount).toFixed(2),
      todayOrder,
      totalAmountOfThisMonth:
        totalAmountOfThisMonth.length === 0
          ? 0
          : parseFloat(totalAmountOfThisMonth[0].total).toFixed(2),
      totalPendingOrder: totalPendingOrder.length === 0 ? 0 : totalPendingOrder[0],
      totalProcessingOrder:
        totalProcessingOrder.length === 0 ? 0 : totalProcessingOrder[0].count,
      totalDeliveredOrder:
        totalDeliveredOrder.length === 0 ? 0 : totalDeliveredOrder[0].count,
      orders,
      weeklySaleReport,
    };
  }
}
