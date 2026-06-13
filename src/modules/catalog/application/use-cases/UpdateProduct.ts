import { Result } from "../../../../shared/kernel/Result";
import {
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/DomainError";
import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import type { CatalogCachePort } from "../ports";

type UpdateError = NotFoundError | ValidationError;

/**
 * UpdateProduct use-case. Mirrors the legacy `updateProduct`: load, apply the
 * merge rules (in the aggregate), persist, then invalidate the cache for both
 * the old and the new slug plus the product listings.
 */
export class UpdateProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort
  ) {}

  async execute(
    id: string,
    dto: Record<string, unknown>
  ): Promise<Result<Record<string, unknown>, UpdateError>> {
    const product = await this.products.findById(id);
    if (!product) return Result.fail(new NotFoundError("Product", id));

    const oldSlug = product.props_.slug.value;

    const updated = product.applyUpdate(dto);
    if (updated.isFail) return Result.fail(updated.getError());

    const saved = await this.products.save(product);

    const newSlug = product.props_.slug.value;
    this.cache.invalidateProductBySlug(oldSlug);
    this.cache.invalidateProductBySlug(newSlug);
    this.cache.invalidateProducts();

    return Result.ok(saved);
  }
}
