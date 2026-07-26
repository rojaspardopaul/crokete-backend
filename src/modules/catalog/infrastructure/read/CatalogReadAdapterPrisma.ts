import type { CatalogReadPort } from "../../application/ports";
import type { CachePort } from "../cache/CachePort";
import { catalog } from "../../../../shared/catalogQueries";

/**
 * Read side of the catalog (CQRS-lite): las consultas complejas no pasan por el
 * agregado y proyectan directamente desde Postgres, que es lo idiomático en
 * rutas de sólo lectura.
 *
 * Las consultas son las de lib/prisma/catalog —las mismas que ejecutan los
 * manejadores heredados—, así que la respuesta es idéntica esté o no activo
 * USE_TS_CATALOG. Aquí sólo vive la política de caché.
 */
export class CatalogReadAdapterPrisma implements CatalogReadPort {
  constructor(private readonly cache: CachePort) {}

  async getProductBySlugCached(slug: string): Promise<{
    data: unknown;
    fromCache: boolean;
    ttl: number;
  }> {
    // Clave propia: `product:slug:` guarda el envoltorio de la tienda, no una
    // ficha suelta; compartirla devolvía la forma equivocada al primero que
    // encontrara el caché poblado por el otro.
    const cacheKey = `product:detail:${slug}`;
    const { data, fromCache } = await this.cache.getOrFetch(cacheKey, () =>
      catalog().findProductBySlug(slug)
    );
    return { data, fromCache, ttl: this.cache.resolveTTL(cacheKey) };
  }

  async getProductById(id: string): Promise<unknown> {
    return catalog().findProductById(id);
  }

  async getShowingProducts(): Promise<unknown[]> {
    return catalog().findShowingProducts();
  }

  async listProductsAdmin(query: {
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
  }> {
    return catalog().listProductsAdmin(query);
  }

  async getStoreProducts(
    params: { category?: string; title?: string; slug?: string; pet?: string; brand?: string },
    isAdmin: boolean
  ): Promise<{ data: unknown; fromCache: boolean; ttl: number; bypass: boolean }> {
    const { category, title, slug, pet, brand } = params;

    // Cache key + TTL mirror the legacy controller.
    let cacheKey: string;
    let ttl: number;
    if (slug) {
      cacheKey = `product:slug:${slug}`;
      ttl = 300;
    } else if (title) {
      cacheKey = `search:title=${title.toLowerCase().trim()}`;
      ttl = 30;
    } else if (category || pet || brand) {
      cacheKey = `products:${[category && `category=${category}`, pet && `pet=${pet}`, brand && `brand=${brand}`]
        .filter(Boolean)
        .join(":")}`;
      ttl = 60;
    } else {
      cacheKey = "products:home";
      ttl = 60;
    }

    if (isAdmin) {
      const data = await catalog().executeStoreQuery(params);
      return { data, fromCache: false, ttl: 0, bypass: true };
    }

    const { data, fromCache } = await this.cache.getOrFetch(
      cacheKey,
      () => catalog().executeStoreQuery(params),
      ttl
    );
    return { data, fromCache, ttl, bypass: false };
  }
}
