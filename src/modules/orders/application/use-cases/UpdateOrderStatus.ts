import { Result } from "../../../../shared/kernel/Result";
import { NotFoundError } from "../../../../shared/errors/DomainError";
import type { EventBus } from "../../../../shared/events/EventBus";
import type { IOrderRepository } from "../../domain/repositories/IOrderRepository";
import type { OrderStatus } from "../../domain/entities/Order";
import type { OrderStatusEffectsPort } from "../ports";

/**
 * UpdateOrderStatus use-case. Replaces the legacy admin `updateOrder`:
 *  1. load the order, capture previous status
 *  2. transition via the aggregate (records OrderStatusChanged)
 *  3. persist
 *  4. run side effects (loyalty coupon restore, points, status email) via an
 *     injected port that reuses the legacy implementation
 *  5. publish the buffered domain events
 *
 * Side effects are awaited-but-isolated like the legacy code (failures are
 * swallowed by the effects adapter, never blocking the status update).
 */
export class UpdateOrderStatus {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly effects: OrderStatusEffectsPort,
    private readonly events: EventBus
  ) {}

  async execute(
    orderId: string,
    newStatus: OrderStatus
  ): Promise<Result<void, NotFoundError>> {
    const order = await this.orders.findById(orderId);
    if (!order) return Result.fail(new NotFoundError("Order", orderId));

    const previousStatus = order.status;
    order.changeStatus(newStatus);

    await this.orders.save(order);

    await this.effects.onStatusChanged(order.snapshot(), newStatus, previousStatus);

    for (const event of order.pullDomainEvents()) {
      await this.events.publish(event);
    }

    return Result.ok(undefined);
  }
}
