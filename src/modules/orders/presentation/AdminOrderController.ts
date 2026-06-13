import type { Request, Response } from "express";
import { DomainError, toHttpStatus } from "../../../shared/errors/DomainError";
import { ORDER_STATUSES, type OrderStatus } from "../domain/entities/Order";
import type { UpdateOrderStatus } from "../application/use-cases/UpdateOrderStatus";
import type { DeleteOrder } from "../application/use-cases/DeleteOrder";
import type { OrderReadPort } from "../application/ports";

/**
 * Thin HTTP adapter for the admin orders surface (/v1/orders). Response shapes
 * match the legacy orderController so the admin dashboard is unaffected.
 */
export class AdminOrderController {
  constructor(
    private readonly updateStatusUC: UpdateOrderStatus,
    private readonly deleteOrderUC: DeleteOrder,
    private readonly read: OrderReadPort
  ) {}

  private wrap(fn: (req: Request) => Promise<unknown>) {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        res.send(await fn(req));
      } catch (err) {
        res.status(500).send({ message: (err as Error).message });
      }
    };
  }

  list = this.wrap((req) =>
    this.read.getAllOrders({
      day: req.query.day as string,
      status: req.query.status as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      method: req.query.method as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      customerName: req.query.customerName as string,
    })
  );

  dashboard = this.wrap((req) =>
    this.read.getDashboardOrders({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
  );

  dashboardRecent = this.wrap((req) =>
    this.read.getDashboardRecentOrder({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
  );

  dashboardCount = this.wrap(() => this.read.getDashboardCount());
  dashboardAmount = this.wrap(() => this.read.getDashboardAmount());
  bestSeller = this.wrap(() => this.read.getBestSellerProductChart());
  getCustomer = this.wrap((req) => this.read.getOrderCustomer(req.params.id as string));
  getById = this.wrap((req) => this.read.getOrderById(req.params.id as string));

  update = async (req: Request, res: Response): Promise<void> => {
    const status = req.body.status as string;
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      res.status(400).send({ message: "Estado de pedido inválido." });
      return;
    }
    const result = await this.updateStatusUC.execute(
      req.params.id as string,
      status as OrderStatus
    );
    if (result.isFail) {
      const err = result.getError() as DomainError;
      res.status(toHttpStatus(err)).send({ message: err.message });
      return;
    }
    res.status(200).send({ message: "Order Updated Successfully!" });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.deleteOrderUC.execute(req.params.id as string);
      res.status(200).send({ message: "Order Deleted Successfully!" });
    } catch (err) {
      res.status(500).send({ message: (err as Error).message || "Error deleting order" });
    }
  };
}
