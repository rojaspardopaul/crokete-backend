/**
 * Low-level cache port. Both the in-module CacheService and the legacy
 * utils/cache.js satisfy this shape, so production can inject the SHARED app
 * cache — keeping invalidation consistent across the TS catalog module and the
 * legacy controllers (reviews/categories/brands all invalidate the same store).
 */
export interface CachePort {
  getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<{ data: T; fromCache: boolean }>;
  del(key: string): void;
  delByPrefix(prefix: string): number;
  flush(): void;
  resolveTTL(key: string, explicit?: number): number;
}
