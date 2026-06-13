import NodeCache from "node-cache";
import type { CachePort } from "./CachePort";

/**
 * Cache-first service with TTL-by-prefix and request coalescing — a compact
 * TypeScript port of the essentials of utils/cache.js. In production wiring the
 * SaaS would inject a shared instance (or Redis) behind this same interface.
 */
const TTL_MAP: Record<string, number> = {
  "search:": 30,
  "products:": 60,
  "product:slug:": 300,
  "categories:": 600,
};
const DEFAULT_TTL = 60;

export class CacheService implements CachePort {
  private readonly cache: NodeCache;
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor() {
    this.cache = new NodeCache({
      stdTTL: DEFAULT_TTL,
      checkperiod: 120,
      useClones: false,
      maxKeys: 500,
    });
  }

  resolveTTL(key: string, explicit?: number): number {
    if (explicit != null) return explicit;
    for (const [prefix, ttl] of Object.entries(TTL_MAP)) {
      if (key.startsWith(prefix)) return ttl;
    }
    return DEFAULT_TTL;
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = this.cache.get<T>(key);
    if (cached !== undefined) return { data: cached, fromCache: true };

    if (this.pending.has(key)) {
      const data = (await this.pending.get(key)) as T;
      return { data, fromCache: true };
    }

    const promise = fetchFn();
    this.pending.set(key, promise);
    try {
      const data = await promise;
      this.cache.set(key, data, this.resolveTTL(key, ttl));
      return { data, fromCache: false };
    } finally {
      this.pending.delete(key);
    }
  }

  del(key: string): void {
    this.cache.del(key);
  }

  delByPrefix(prefix: string): number {
    const keys = this.cache.keys().filter((k) => k.startsWith(prefix));
    if (keys.length > 0) this.cache.del(keys);
    return keys.length;
  }

  flush(): void {
    this.cache.flushAll();
  }
}
