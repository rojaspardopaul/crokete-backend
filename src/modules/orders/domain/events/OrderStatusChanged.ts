import type { DomainEvent } from "../../../../shared/events/DomainEvent";

export const ORDER_STATUS_CHANGED = "orders.order.status_changed";

/** Emitted when an order's fulfillment status transitions. */
export class OrderStatusChanged implements DomainEvent {
  readonly name = ORDER_STATUS_CHANGED;
  readonly occurredAt = new Date();

  constructor(
    public readonly orderId: string,
    public readonly from: string,
    public readonly to: string,
    public readonly tenantId?: string
  ) {}
}
