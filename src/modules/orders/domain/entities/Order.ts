import { AggregateRoot } from "../../../../shared/kernel/AggregateRoot";
import { Result } from "../../../../shared/kernel/Result";
import { ConflictError } from "../../../../shared/errors/DomainError";
import { OrderPaid, type OrderLineItem } from "../events/OrderPaid";
import { OrderStatusChanged } from "../events/OrderStatusChanged";

/** Fulfillment lifecycle statuses (matches the legacy Order schema enum). */
export const ORDER_STATUSES = [
  "pedido",
  "empaquetado",
  "en_reparto",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

interface OrderProps {
  status: OrderStatus;
  paid: boolean;
  /**
   * Full persistence snapshot. The admin module is read-heavy and its side
   * effects (loyalty, status emails) need the whole document; carrying it here
   * keeps the use-cases simple while the aggregate still owns the transitions.
   */
  snapshot: Record<string, unknown>;
}

export class Order extends AggregateRoot<string> {
  private props: OrderProps;

  private constructor(id: string, props: OrderProps) {
    super(id);
    this.props = props;
  }

  /** Build the aggregate from a raw Mongo document. */
  static fromDocument(doc: Record<string, unknown>): Order {
    return new Order(String(doc._id), {
      status: (doc.status as OrderStatus) ?? "pedido",
      paid: Boolean(doc.paid),
      snapshot: doc,
    });
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get isPaid(): boolean {
    return this.props.paid;
  }

  /** Raw document with the current (possibly updated) status applied. */
  snapshot(): Record<string, unknown> {
    return { ...this.props.snapshot, status: this.props.status };
  }

  /**
   * Transitions the fulfillment status. Mirrors the legacy admin behaviour
   * (any status is assignable; re-setting the same status is allowed) but
   * records a domain event only when the status actually changes, and is the
   * single place a transition can happen.
   */
  changeStatus(newStatus: OrderStatus): void {
    const from = this.props.status;
    this.props.status = newStatus;
    if (from !== newStatus) {
      this.addDomainEvent(
        new OrderStatusChanged(this.id, from, newStatus, this.tenantId())
      );
    }
  }

  /**
   * Marks the order paid (payment-gateway confirmation). Idempotent: paying an
   * already-paid order is a ConflictError so duplicate webhooks don't double
   * decrement stock or double-grant points. Emits OrderPaid.
   */
  confirmPayment(): Result<void, ConflictError> {
    if (this.props.paid) {
      return Result.fail(new ConflictError("Order is already paid"));
    }
    this.props.paid = true;
    const s = this.props.snapshot;
    const items: OrderLineItem[] = Array.isArray(s.cart)
      ? (s.cart as Record<string, unknown>[]).map((i) => ({
          _id: String(i._id),
          quantity: Number(i.quantity) || 0,
          isCombination: Boolean(i.isCombination),
          variant: i.variant as { productId?: string } | undefined,
        }))
      : [];
    this.addDomainEvent(
      new OrderPaid(
        this.id,
        s.user ? String(s.user) : null,
        items,
        Number(s.total) || 0,
        this.tenantId()
      )
    );
    return Result.ok(undefined);
  }

  private tenantId(): string | undefined {
    const t = this.props.snapshot.tenantId;
    return t ? String(t) : undefined;
  }
}

export type { OrderProps };
