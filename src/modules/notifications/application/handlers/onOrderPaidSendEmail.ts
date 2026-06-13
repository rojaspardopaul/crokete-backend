import type { EventHandler } from "../../../../shared/events/EventBus";
import type { OrderPaid } from "../../../orders/domain/events/OrderPaid";
import type { Logger } from "../../../../shared/logger";
import type { NotificationPort } from "../NotificationPort";

/** OrderPaid subscriber: sends the order confirmation email. */
export function onOrderPaidSendEmail(
  notifications: NotificationPort,
  logger: Logger
): EventHandler<OrderPaid> {
  return async (event) => {
    try {
      await notifications.sendOrderConfirmation({
        orderId: event.orderId,
        customerId: event.customerId,
      });
    } catch (err) {
      logger.error(
        { orderId: event.orderId, err: (err as Error).message },
        "[notifications] failed to send order confirmation email"
      );
      throw err;
    }
  };
}
