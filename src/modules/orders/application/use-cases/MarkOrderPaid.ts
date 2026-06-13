import { Result } from "../../../../shared/kernel/Result";
import {
  ConflictError,
  NotFoundError,
} from "../../../../shared/errors/DomainError";
import type { EventBus } from "../../../../shared/events/EventBus";
import type { IOrderRepository } from "../../domain/repositories/IOrderRepository";

type MarkPaidError = NotFoundError | ConflictError;

/**
 * MarkOrderPaid use-case. Single entry point for the paid transition (called by
 * the Stripe/PayPal/Razorpay webhook handlers). Persists first, then publishes
 * the buffered OrderPaid event so subscribers (stock, loyalty, email) run.
 */
export class MarkOrderPaid {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly events: EventBus
  ) {}

  async execute(orderId: string): Promise<Result<void, MarkPaidError>> {
    const order = await this.orders.findById(orderId);
    if (!order) return Result.fail(new NotFoundError("Order", orderId));

    const paid = order.markPaid();
    if (paid.isFail) return Result.fail(paid.getError());

    await this.orders.save(order);

    for (const event of order.pullDomainEvents()) {
      await this.events.publish(event);
    }

    return Result.ok(undefined);
  }
}
