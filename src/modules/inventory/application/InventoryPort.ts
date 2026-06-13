import type { OrderLineItem } from "../../orders/domain/events/OrderPaid";

/**
 * Inventory write port. Today it decrements stock embedded in Product; this
 * interface is the seam that lets the SaaS move to a separate InventoryItem
 * aggregate (multi-warehouse, reservations) without touching the OrderPaid
 * subscriber.
 */
export interface InventoryPort {
  decrementForOrder(items: OrderLineItem[]): Promise<void>;
}
