import { Result } from "../../../../shared/kernel/Result";
import { ValidationError } from "../../../../shared/errors/DomainError";
import type { EventBus } from "../../../../shared/events/EventBus";
import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/entities/Product";
import type { CatalogCachePort } from "../ports";
import { toProductCreateInput } from "../dto-mapper";

/**
 * CreateProduct use-case. Replaces the legacy `addProduct` controller body:
 * validates through the aggregate, persists, invalidates cache, then dispatches
 * the buffered ProductCreated event. Returns the stored document so the
 * controller can keep the exact legacy response shape.
 */
export class CreateProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort,
    private readonly events: EventBus
  ) {}

  async execute(
    dto: Record<string, unknown>
  ): Promise<Result<Record<string, unknown>, ValidationError>> {
    const input = toProductCreateInput(dto);

    // Parity with legacy: productId defaults to a fresh ObjectId when absent.
    const id = this.products.nextIdentity();
    if (!input.productId) input.productId = id;

    const created = Product.create(id, input);
    if (created.isFail) return Result.fail(created.getError());

    const product = created.getValue();
    const saved = await this.products.save(product);

    this.cache.invalidateProducts();

    for (const event of product.pullDomainEvents()) {
      await this.events.publish(event);
    }

    return Result.ok(saved);
  }
}
