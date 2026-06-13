import mongoose from "mongoose";
import type { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/entities/Product";
import { ProductModel } from "../mongoose/ProductModel";
import { ProductMapper } from "../mappers/ProductMapper";

/** Mongoose-backed implementation of the write-side Product repository. */
export class ProductRepositoryMongo implements IProductRepository {
  nextIdentity(): string {
    return new mongoose.Types.ObjectId().toString();
  }

  async findById(id: string): Promise<Product | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ProductModel.findById(id).lean();
    return doc ? ProductMapper.toDomain(doc as Record<string, unknown>) : null;
  }

  async save(product: Product): Promise<Record<string, unknown>> {
    const data = ProductMapper.toPersistence(product);
    const { _id, ...rest } = data;
    const saved = await ProductModel.findByIdAndUpdate(_id, rest, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).lean();
    return saved as Record<string, unknown>;
  }

  async delete(id: string): Promise<void> {
    await ProductModel.deleteOne({ _id: id });
  }

  async deleteMany(ids: string[]): Promise<void> {
    await ProductModel.deleteMany({ _id: { $in: ids } });
  }

  async replaceAll(docs: Record<string, unknown>[]): Promise<void> {
    await ProductModel.deleteMany({});
    await ProductModel.insertMany(docs);
  }

  async updateMany(ids: string[], data: Record<string, unknown>): Promise<void> {
    await ProductModel.updateMany({ _id: { $in: ids } }, { $set: data });
  }
}
