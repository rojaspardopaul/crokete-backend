import type { DomainEvent } from "../../../../shared/events/DomainEvent";

export const ORDER_PAID = "orders.order.paid";

/** A line item as captured in the order's cart snapshot. */
export interface OrderLineItem {
  _id: string;
  quantity: number;
  isCombination?: boolean;
  variant?: { productId?: string };
}

/**
 * Emitted when an order transitions to paid. This is the integration point that
 * fans out to other contexts: inventory (decrement stock), loyalty (grant
 * points), notifications (send confirmation email). Subscribers live in their
 * own modules and never call each other.
 */
export class OrderPaid implements DomainEvent {
  readonly name = ORDER_PAID;
  readonly occurredAt = new Date();

  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly items: OrderLineItem[],
    public readonly total: number,
    public readonly tenantId?: string
  ) {}
}
