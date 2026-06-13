import { Router, type RequestHandler } from "express";
import { eventBus as defaultEventBus, type EventBus } from "../../shared/events/EventBus";
import type { IOrderRepository } from "./domain/repositories/IOrderRepository";
import type { OrderReadPort, OrderStatusEffectsPort } from "./application/ports";
import { UpdateOrderStatus } from "./application/use-cases/UpdateOrderStatus";
import { DeleteOrder } from "./application/use-cases/DeleteOrder";
import { AdminOrderController } from "./presentation/AdminOrderController";
import { createAdminOrderRouter } from "./presentation/adminOrderRoutes";
import { OrderRepositoryMongo } from "./infrastructure/OrderRepositoryMongo";
import { OrderReadAdapter } from "./infrastructure/OrderReadAdapter";

export interface AdminOrdersModuleDeps {
  /** Status side effects (loyalty + email). Required: pass the legacy adapter. */
  effects: OrderStatusEffectsPort;
  orders?: IOrderRepository;
  read?: OrderReadPort;
  events?: EventBus;
  /** Applied to every admin route (e.g. [isAdmin]; isAuth stays at the mount). */
  guard?: RequestHandler[];
}

/**
 * Composition root for the admin orders surface (/v1/orders). Read-heavy plus
 * status-update and delete. The customer/payment flow (/v1/order) is NOT part
 * of this module and stays on the legacy controller.
 */
export function buildAdminOrdersModule(deps: AdminOrdersModuleDeps): {
  router: Router;
  useCases: { updateOrderStatus: UpdateOrderStatus; deleteOrder: DeleteOrder };
} {
  const events = deps.events ?? defaultEventBus;
  const orders = deps.orders ?? new OrderRepositoryMongo();
  const read = deps.read ?? new OrderReadAdapter();

  const updateOrderStatus = new UpdateOrderStatus(orders, deps.effects, events);
  const deleteOrder = new DeleteOrder(orders);

  const controller = new AdminOrderController(updateOrderStatus, deleteOrder, read);

  return {
    router: createAdminOrderRouter(controller, deps.guard ?? []),
    useCases: { updateOrderStatus, deleteOrder },
  };
}
