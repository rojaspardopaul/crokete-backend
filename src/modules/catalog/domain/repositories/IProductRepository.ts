import type { Product } from "../entities/Product";

/**
 * Write-side repository for the Product aggregate. The domain depends only on
 * this interface; the Mongoose implementation lives in infrastructure. This is
 * the seam that lets the SaaS swap in a tenant-scoped repository without
 * touching domain or application code.
 */
export interface IProductRepository {
  /** Generates a new persistence identity (Mongo ObjectId hex string). */
  nextIdentity(): string;

  findById(id: string): Promise<Product | null>;

  /** Persists (insert or update) the aggregate. Returns the raw stored doc. */
  save(product: Product): Promise<Record<string, unknown>>;

  delete(id: string): Promise<void>;

  deleteMany(ids: string[]): Promise<void>;

  /** Bulk replace the whole collection (mirrors legacy addAllProducts). */
  replaceAll(docs: Record<string, unknown>[]): Promise<void>;

  /** Bulk $set the given fields on many products (mirrors updateManyProducts). */
  updateMany(ids: string[], data: Record<string, unknown>): Promise<void>;
}
