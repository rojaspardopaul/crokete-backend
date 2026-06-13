import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../shared/events/EventBus";
import { logger } from "../../shared/logger";
import { Order } from "./domain/entities/Order";
import type { IOrderRepository } from "./domain/repositories/IOrderRepository";
import { buildOrdersModule } from "./OrdersModule";
import type { InventoryPort } from "../inventory/application/InventoryPort";
import type { LoyaltyPort } from "../loyalty/application/LoyaltyPort";
import type { NotificationPort } from "../notifications/application/NotificationPort";

function makeOrder(id: string) {
  return Order.rehydrate(id, {
    customerId: "cust1",
    items: [{ _id: "p1", quantity: 2 }],
    total: 150,
    status: "Pending",
  });
}

function repoWith(order: Order): IOrderRepository {
  return {
    findById: async () => order,
    save: vi.fn(async () => {}),
  };
}

describe("OrderPaid flow", () => {
  it("MarkOrderPaid fans out to inventory, loyalty and notifications", async () => {
    const bus = new EventBus();
    const inventory: InventoryPort = { decrementForOrder: vi.fn(async () => {}) };
    const loyalty: LoyaltyPort = { grantPointsForOrder: vi.fn(async () => {}) };
    const notifications: NotificationPort = {
      sendOrderConfirmation: vi.fn(async () => {}),
    };

    const { markOrderPaid, unsubscribe } = buildOrdersModule({
      orders: repoWith(makeOrder("o1")),
      events: bus,
      logger,
      inventory,
      loyalty,
      notifications,
    });

    const result = await markOrderPaid.execute("o1");

    expect(result.isOk).toBe(true);
    expect(inventory.decrementForOrder).toHaveBeenCalledOnce();
    expect(loyalty.grantPointsForOrder).toHaveBeenCalledWith({
      orderId: "o1",
      customerId: "cust1",
      total: 150,
    });
    expect(notifications.sendOrderConfirmation).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("is idempotent: paying an already-paid order is a conflict and emits nothing", async () => {
    const bus = new EventBus();
    const inventory: InventoryPort = { decrementForOrder: vi.fn(async () => {}) };

    const order = Order.rehydrate("o2", {
      customerId: "cust1",
      items: [{ _id: "p1", quantity: 1 }],
      total: 10,
      status: "Paid",
    });

    const { markOrderPaid, unsubscribe } = buildOrdersModule({
      orders: repoWith(order),
      events: bus,
      inventory,
    });

    const result = await markOrderPaid.execute("o2");

    expect(result.isFail).toBe(true);
    expect(result.getError().code).toBe("CONFLICT");
    expect(inventory.decrementForOrder).not.toHaveBeenCalled();
    unsubscribe();
  });
});
