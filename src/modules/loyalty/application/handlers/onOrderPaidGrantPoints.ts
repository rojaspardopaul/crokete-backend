import type { EventHandler } from "../../../../shared/events/EventBus";
import type { OrderPaid } from "../../../orders/domain/events/OrderPaid";
import type { Logger } from "../../../../shared/logger";
import type { LoyaltyPort } from "../LoyaltyPort";

/** OrderPaid subscriber: awards loyalty points to the customer. */
export function onOrderPaidGrantPoints(
  loyalty: LoyaltyPort,
  logger: Logger
): EventHandler<OrderPaid> {
  return async (event) => {
    if (!event.customerId) return; // guest checkout — no points
    try {
      await loyalty.grantPointsForOrder({
        orderId: event.orderId,
        customerId: event.customerId,
        total: event.total,
      });
    } catch (err) {
      logger.error(
        { orderId: event.orderId, err: (err as Error).message },
        "[loyalty] failed to grant points for paid order"
      );
      throw err;
    }
  };
}
