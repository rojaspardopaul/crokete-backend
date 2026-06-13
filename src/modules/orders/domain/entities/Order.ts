import { AggregateRoot } from "../../../../shared/kernel/AggregateRoot";
import { Result } from "../../../../shared/kernel/Result";
import { ConflictError } from "../../../../shared/errors/DomainError";
import { OrderPaid, type OrderLineItem } from "../events/OrderPaid";

export type OrderStatus = "Pending" | "Processing" | "Paid" | "Cancel";

interface OrderProps {
  customerId: string | null;
  items: OrderLineItem[];
  total: number;
  status: OrderStatus;
  tenantId?: string;
}

/**
 * Order aggregate (focused slice for the lab). The teaching point is `markPaid`:
 * the single place where the paid transition is enforced and the OrderPaid
 * event is recorded — replacing logic that was previously inlined and duplicated
 * across orderController.js and stripeWebhookController.js.
 */
export class Order extends AggregateRoot<string> {
  private props: OrderProps;

  private constructor(id: string, props: OrderProps) {
    super(id);
    this.props = props;
  }

  static rehydrate(id: string, props: OrderProps): Order {
    return new Order(id, props);
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  /**
   * Marks the order as paid. Idempotency guard: paying an already-paid order is
   * a no-op-failure (ConflictError) so webhooks delivered twice don't double
   * decrement stock or double-grant points.
   */
  markPaid(): Result<void, ConflictError> {
    if (this.props.status === "Paid") {
      return Result.fail(new ConflictError("Order is already paid"));
    }
    this.props.status = "Paid";
    this.addDomainEvent(
      new OrderPaid(
        this.id,
        this.props.customerId,
        this.props.items,
        this.props.total,
        this.props.tenantId
      )
    );
    return Result.ok(undefined);
  }
}

export type { OrderProps };
