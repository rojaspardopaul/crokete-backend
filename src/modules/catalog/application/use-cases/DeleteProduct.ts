import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import type { CatalogCachePort } from "../ports";

/** Mirrors legacy `deleteProduct` and `deleteManyProducts`. */
export class DeleteProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort
  ) {}

  async execute(id: string): Promise<void> {
    await this.products.delete(id);
    this.cache.invalidateProducts();
  }

  async executeMany(ids: string[]): Promise<void> {
    await this.products.deleteMany(ids);
    this.cache.invalidateProducts();
  }
}
