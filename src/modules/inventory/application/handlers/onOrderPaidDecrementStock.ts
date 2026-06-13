import type { EventHandler } from "../../../../shared/events/EventBus";
import type { OrderPaid } from "../../../orders/domain/events/OrderPaid";
import type { Logger } from "../../../../shared/logger";
import type { InventoryPort } from "../InventoryPort";

/**
 * OrderPaid subscriber: decrements stock for every line item. Returns an
 * EventHandler so the wiring layer can subscribe it to the bus. Errors are
 * logged and rethrown so the EventBus records them, but other subscribers
 * (loyalty, email) still run.
 */
export function onOrderPaidDecrementStock(
  inventory: InventoryPort,
  logger: Logger
): EventHandler<OrderPaid> {
  return async (event) => {
    try {
      await inventory.decrementForOrder(event.items);
    } catch (err) {
      logger.error(
        { orderId: event.orderId, err: (err as Error).message },
        "[inventory] failed to decrement stock for paid order"
      );
      throw err;
    }
  };
}
