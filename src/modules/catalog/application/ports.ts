/**
 * Application-layer ports (driven adapters). Implemented in infrastructure,
 * injected into use-cases. Keeping these as interfaces is what makes the
 * use-cases unit-testable without a database or a cache server.
 */

/** Cache invalidation triggered by catalog writes. */
export interface CatalogCachePort {
  invalidateProducts(): void;
  invalidateProductBySlug(slug: string): void;
  invalidateAll(): void;
}

/** Read model for catalog queries (CQRS-lite read side). */
export interface CatalogReadPort {
  getProductBySlugCached(slug: string): Promise<{
    data: unknown;
    fromCache: boolean;
    ttl: number;
  }>;

  listProductsAdmin(query: {
    title?: string;
    category?: string;
    price?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    products: unknown[];
    totalDoc: number;
    limits?: number;
    pages?: number;
  }>;

  getShowingProducts(): Promise<unknown[]>;

  getProductById(id: string): Promise<unknown>;

  /**
   * Storefront bundle (products + popular + discounted + related + reviews),
   * mirroring the legacy getShowingStoreProducts. Cache-first unless `isAdmin`.
   */
  getStoreProducts(
    params: {
      category?: string;
      title?: string;
      slug?: string;
      pet?: string;
      brand?: string;
    },
    isAdmin: boolean
  ): Promise<{ data: unknown; fromCache: boolean; ttl: number; bypass: boolean }>;
}
