/**
 * Base shape for every internal domain event.
 *
 * Events are plain, serializable facts about something that already happened
 * (past tense: ProductCreated, OrderPaid). They carry the minimum data a
 * subscriber needs, never behaviour.
 */
export interface DomainEvent {
  /** Stable event name, e.g. "catalog.product.created". */
  readonly name: string;
  /** When the event occurred. */
  readonly occurredAt: Date;
  /**
   * Tenant the event belongs to. Optional in Crokete (single-tenant) but
   * present in the contract so the SaaS can route/scope events per tenant
   * without changing the EventBus.
   */
  readonly tenantId?: string;
}
