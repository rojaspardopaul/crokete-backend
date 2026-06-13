import type { CatalogCachePort } from "../../application/ports";
import type { CachePort } from "./CachePort";

/**
 * Implements the catalog cache invalidation port on top of CacheService.
 * Mirrors lib/cache/invalidation.js: product writes clear product, search and
 * category caches (search results depend on category/brand names).
 */
export class CatalogCacheAdapter implements CatalogCachePort {
  constructor(private readonly cache: CachePort) {}

  invalidateProducts(): void {
    this.cache.delByPrefix("products:");
    this.cache.delByPrefix("search:");
    this.cache.delByPrefix("product:slug:");
    this.cache.delByPrefix("categories:");
  }

  invalidateProductBySlug(slug: string): void {
    if (!slug) return;
    this.cache.del(`product:slug:${slug}`);
  }

  invalidateAll(): void {
    this.cache.flush();
  }
}
