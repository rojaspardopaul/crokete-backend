import { randomUUID } from "node:crypto";
import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/entities/Product";
import { ProductMapper } from "../mappers/ProductMapper";
import { catalog } from "../../../../shared/catalogQueries";
import { uuidList } from "../../../../shared/prisma";

/**
 * Repositorio de escritura del producto sobre Postgres.
 *
 * El agregado sigue hablando la forma heredada del documento (`prices`
 * anidado, variantes en línea, categorías por id): la traducción al esquema
 * normalizado la hace lib/prisma/catalog, el mismo módulo que usan los
 * controladores JS.
 */
export class ProductRepositoryPrisma implements IProductRepository {
  /** La identidad ahora es un uuid, que es lo que espera la columna `id`. */
  nextIdentity(): string {
    return randomUUID();
  }

  async findById(id: string): Promise<Product | null> {
    const doc = await catalog().findProductById(id);
    return doc ? ProductMapper.toDomain(doc) : null;
  }

  async save(product: Product): Promise<Record<string, unknown>> {
    const doc = ProductMapper.toPersistence(product);
    const saved = await catalog().saveProductDoc(doc);
    return saved ?? {};
  }

  async delete(id: string): Promise<void> {
    await catalog().deleteProductById(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await catalog().deleteProducts(uuidList(ids));
  }

  async replaceAll(docs: Record<string, unknown>[]): Promise<void> {
    await catalog().replaceAllProducts(docs);
  }

  async updateMany(ids: string[], data: Record<string, unknown>): Promise<void> {
    await catalog().updateManyProducts(uuidList(ids), data);
  }
}
