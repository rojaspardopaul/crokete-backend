import type { DomainEvent } from "../../../../shared/events/DomainEvent";

export const PRODUCT_CREATED = "catalog.product.created";

/** Emitted when a new product is added to the catalog. */
export class ProductCreated implements DomainEvent {
  readonly name = PRODUCT_CREATED;
  readonly occurredAt = new Date();

  constructor(
    public readonly productId: string,
    public readonly slug: string,
    public readonly tenantId?: string
  ) {}
}
