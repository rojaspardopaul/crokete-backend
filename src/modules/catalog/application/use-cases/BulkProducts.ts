import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import type { CatalogCachePort } from "../ports";

/**
 * Bulk operations (admin/import tooling). These mirror the legacy
 * addAllProducts and updateManyProducts. They are deliberately NOT routed
 * through the aggregate — bulk import/patch is an admin data operation, not a
 * per-product business transaction — but they live behind the use-case boundary
 * and own cache invalidation.
 */
export class ReplaceAllProducts {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort
  ) {}

  async execute(docs: Record<string, unknown>[]): Promise<void> {
    await this.products.replaceAll(docs);
    this.cache.invalidateAll();
  }
}

export class UpdateManyProducts {
  constructor(
    private readonly products: IProductRepository,
    private readonly cache: CatalogCachePort
  ) {}

  /** Filters out the `ids` key and empty payloads, like the legacy controller. */
  async execute(ids: string[], body: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === "ids") continue;
      if (value === "[]") continue;
      if (value && typeof value === "object" && Object.keys(value).length === 0) continue;
      data[key] = value;
    }
    await this.products.updateMany(ids, data);
    this.cache.invalidateProducts();
  }
}
