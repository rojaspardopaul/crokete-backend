import { Result } from "../../../../shared/kernel/Result";
import { NotFoundError } from "../../../../shared/errors/DomainError";
import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import type { ProductStatus } from "../../domain/entities/Product";
import type { CatalogCachePort } from "../ports";

/** Mirrors legacy `updateStatus` (PUT /products/status/:id). */
export class ChangeProductStatus {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort
  ) {}

  async execute(
    id: string,
    status: ProductStatus
  ): Promise<Result<void, NotFoundError>> {
    const product = await this.products.findById(id);
    if (!product) return Result.fail(new NotFoundError("Product", id));

    product.changeStatus(status);
    await this.products.save(product);
    this.cache.invalidateProducts();
    return Result.ok(undefined);
  }
}
