import type { NotificationPort } from "../application/NotificationPort";
import type { Logger } from "../../../shared/logger";

/**
 * Placeholder NotificationPort for the lab. The real SMTP send lives in the
 * legacy lib/email-sender and will be wrapped behind this port when the
 * notifications context is migrated.
 */
export class LoggingNotificationAdapter implements NotificationPort {
  constructor(private readonly logger: Logger) {}

  async sendOrderConfirmation(input: {
    orderId: string;
    customerId: string | null;
  }): Promise<void> {
    this.logger.info(
      { orderId: input.orderId, customerId: input.customerId },
      "[notifications] order confirmation email queued"
    );
  }
}
