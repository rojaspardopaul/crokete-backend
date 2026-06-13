import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/entities/Product";
import { ProductMapper } from "../mappers/ProductMapper";

/**
 * In-memory IProductRepository for fast, DB-free tests. Stores the persistence
 * projection (via the same ProductMapper used in production) so round-trips
 * exercise the real mapping logic.
 */
export class InMemoryProductRepository implements IProductRepository {
  private store = new Map<string, Record<string, unknown>>();
  private counter = 0;

  nextIdentity(): string {
    this.counter += 1;
    return this.counter.toString(16).padStart(24, "0");
  }

  async findById(id: string): Promise<Product | null> {
    const doc = this.store.get(id);
    return doc ? ProductMapper.toDomain(doc) : null;
  }

  async save(product: Product): Promise<Record<string, unknown>> {
    const doc = ProductMapper.toPersistence(product);
    this.store.set(product.id, doc);
    return doc;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    ids.forEach((id) => this.store.delete(id));
  }

  async replaceAll(docs: Record<string, unknown>[]): Promise<void> {
    this.store.clear();
    docs.forEach((d) => this.store.set(String(d._id ?? this.nextIdentity()), d));
  }

  async updateMany(ids: string[], data: Record<string, unknown>): Promise<void> {
    for (const id of ids) {
      const doc = this.store.get(id);
      if (doc) this.store.set(id, { ...doc, ...data });
    }
  }

  // Test helpers
  count(): number {
    return this.store.size;
  }
  raw(id: string): Record<string, unknown> | undefined {
    return this.store.get(id);
  }
}
