import type { LoyaltyPort } from "../application/LoyaltyPort";
import type { Logger } from "../../../shared/logger";

/**
 * Placeholder LoyaltyPort implementation for the lab. It computes points
 * (1 point per currency unit, floored) and logs the award. The real
 * implementation — writing PointTransaction against LoyaltyConfig — lives in the
 * legacy lib and will be ported when the loyalty context is migrated.
 */
export class LoggingLoyaltyAdapter implements LoyaltyPort {
  constructor(private readonly logger: Logger) {}

  async grantPointsForOrder(input: {
    orderId: string;
    customerId: string | null;
    total: number;
  }): Promise<void> {
    const points = Math.floor(input.total);
    this.logger.info(
      { orderId: input.orderId, customerId: input.customerId, points },
      "[loyalty] points granted for paid order"
    );
  }
}
