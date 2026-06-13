import type { CatalogReadPort } from "../../application/ports";
import type { CachePort } from "../cache/CachePort";
import { ProductModel } from "../mongoose/ProductModel";
import { CategoryModel } from "../mongoose/CategoryModel";
import { BrandModel, ReviewModel } from "../mongoose/RefModels";
import { escapeRegex, findDescendantCategoryIds, SEARCHABLE_LOCALES } from "./helpers";

const POP_CATEGORY = { path: "category", select: "name _id" };
const POP_PET = { path: "pet", select: "name _id" };
const POP_BRAND = { path: "brand", select: "name _id" };

/**
 * Read side of the catalog (CQRS-lite): complex queries bypass the aggregate
 * and project straight from Mongo, which is idiomatic for read-heavy paths.
 * Faithful port of the legacy read handlers (getAllProducts, getProductBySlug,
 * getProductById, getShowingProducts).
 *
 * The store mega-query (`getShowingStoreProducts`) is intentionally NOT ported
 * here yet — it stays on the legacy controller until a dedicated read model is
 * built, to keep this reference module focused.
 */
export class CatalogReadAdapter implements CatalogReadPort {
  constructor(private readonly cache: CachePort) {}

  async getProductBySlugCached(slug: string): Promise<{
    data: unknown;
    fromCache: boolean;
    ttl: number;
  }> {
    const cacheKey = `product:slug:${slug}`;
    const { data, fromCache } = await this.cache.getOrFetch(cacheKey, () =>
      ProductModel.findOne({ slug }).lean()
    );
    return { data, fromCache, ttl: this.cache.resolveTTL(cacheKey) };
  }

  async getProductById(id: string): Promise<unknown> {
    return ProductModel.findById(id)
      .populate({ path: "category", select: "_id name" })
      .populate({ path: "categories", select: "_id name" })
      .lean();
  }

  async getShowingProducts(): Promise<unknown[]> {
    return ProductModel.find({ status: "show" }).sort({ _id: -1 }).lean();
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
    const { title, category, price, page, limit } = query;
    const queryObject: Record<string, unknown> = {};
    let sortObject: Record<string, 1 | -1> = {};

    if (title) {
      const safeTitle = escapeRegex(title);
      queryObject.$or = SEARCHABLE_LOCALES.map((lang) => ({
        [`title.${lang}`]: { $regex: safeTitle, $options: "i" },
      }));
    }

    switch (price) {
      case "low": sortObject = { "prices.originalPrice": 1 }; break;
      case "high": sortObject = { "prices.originalPrice": -1 }; break;
      case "published": queryObject.status = "show"; break;
      case "unPublished": queryObject.status = "hide"; break;
      case "status-selling": queryObject.stock = { $gt: 0 }; break;
      case "status-out-of-stock": queryObject.stock = { $lt: 1 }; break;
      case "date-added-asc": sortObject = { createdAt: 1 }; break;
      case "date-added-desc": sortObject = { createdAt: -1 }; break;
      case "date-updated-asc": sortObject = { updatedAt: 1 }; break;
      case "date-updated-desc": sortObject = { updatedAt: -1 }; break;
      default: sortObject = { _id: -1 };
    }

    let categoryFilterIds: string[] = [];
    if (category) {
      const categories = await CategoryModel.find({}).select("_id parentId").lean();
      categoryFilterIds = findDescendantCategoryIds(
        categories as { _id: unknown; parentId?: unknown }[],
        category
      );
    }
    if (categoryFilterIds.length > 0) {
      queryObject.$and = [
        {
          $or: [
            { categories: { $in: categoryFilterIds } },
            { category: { $in: categoryFilterIds } },
          ],
        },
      ];
    }
    if (queryObject.$or && queryObject.$and) {
      (queryObject.$and as unknown[]).unshift({ $or: queryObject.$or });
      delete queryObject.$or;
    }

    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    const totalDoc = await ProductModel.countDocuments(queryObject);
    const products = await ProductModel.find(queryObject)
      .populate({ path: "category", select: "_id name" })
      .populate({ path: "categories", select: "_id name" })
      .sort(sortObject)
      .skip(Number.isFinite(skip) ? skip : 0)
      .limit(Number.isFinite(limits) ? limits : 0)
      .lean();

    return { products, totalDoc, limits, pages };
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
      const data = await this.executeStoreQuery(params);
      return { data, fromCache: false, ttl: 0, bypass: true };
    }

    const { data, fromCache } = await this.cache.getOrFetch(
      cacheKey,
      () => this.executeStoreQuery(params),
      ttl
    );
    return { data, fromCache, ttl, bypass: false };
  }

  /** Faithful port of legacy executeStoreQuery (productController.js). */
  private async executeStoreQuery(params: {
    category?: string;
    title?: string;
    slug?: string;
    pet?: string;
    brand?: string;
  }): Promise<unknown> {
    const { category, title, slug, pet, brand } = params;
    const queryObject: Record<string, unknown> = { status: "show" };
    let categoryFilterIds: string[] = [];

    if (category) {
      const categories = await CategoryModel.find({ status: "show" })
        .select("_id parentId")
        .lean();
      categoryFilterIds = findDescendantCategoryIds(
        categories as { _id: unknown; parentId?: unknown }[],
        category
      );
    }
    if (pet) queryObject.pet = pet;
    if (brand) queryObject.brand = brand;

    if (title) {
      const safeTitle = escapeRegex(title);
      const regex = { $regex: safeTitle, $options: "i" };
      const fieldQueries: Record<string, unknown>[] = SEARCHABLE_LOCALES.flatMap((lang) => [
        { [`title.${lang}`]: regex },
        { [`description.${lang}`]: regex },
      ]);
      fieldQueries.push({ tag: regex });

      const [matchingBrands, matchingCategories] = await Promise.all([
        BrandModel.find({ $or: SEARCHABLE_LOCALES.map((l) => ({ [`name.${l}`]: regex })) })
          .select("_id")
          .maxTimeMS(5000),
        CategoryModel.find({ $or: SEARCHABLE_LOCALES.map((l) => ({ [`name.${l}`]: regex })) })
          .select("_id")
          .maxTimeMS(5000),
      ]);
      if (matchingBrands.length > 0) {
        fieldQueries.push({ brand: { $in: matchingBrands.map((b) => b._id) } });
      }
      if (matchingCategories.length > 0) {
        const catIds = matchingCategories.map((c) => c._id);
        fieldQueries.push({ category: { $in: catIds } });
        fieldQueries.push({ categories: { $in: catIds } });
      }
      queryObject.$or = fieldQueries;
    }

    if (categoryFilterIds.length > 0) {
      const categoryClause = {
        $or: [
          { categories: { $in: categoryFilterIds } },
          { category: { $in: categoryFilterIds } },
        ],
      };
      if (queryObject.$or) {
        queryObject.$and = [{ $or: queryObject.$or }, categoryClause];
        delete queryObject.$or;
      } else {
        queryObject.$or = categoryClause.$or;
      }
    }

    if (slug) {
      queryObject.slug = { $regex: escapeRegex(slug), $options: "i" };
    }

    let products: Record<string, unknown>[] = [];
    let popularProducts: unknown[] = [];
    let discountedProducts: unknown[] = [];
    let relatedProducts: unknown[] = [];
    let reviews: unknown[] = [];

    if (slug) {
      products = await ProductModel.find(queryObject)
        .populate(POP_CATEGORY).populate(POP_PET).populate(POP_BRAND)
        .sort({ _id: -1 }).limit(100).maxTimeMS(5000).lean();
      relatedProducts = await ProductModel.find({ category: products[0]?.category })
        .populate({ path: "category", select: "_id name" }).populate(POP_PET).populate(POP_BRAND)
        .maxTimeMS(5000).lean();
      if (products[0]?._id) {
        reviews = await ReviewModel.find({ product: products[0]._id, status: "approved" })
          .populate({ path: "user", select: "name image" }).maxTimeMS(5000).lean();
      }
    } else if (title || category || pet || brand) {
      products = await ProductModel.find(queryObject)
        .populate(POP_CATEGORY).populate(POP_PET).populate(POP_BRAND)
        .sort({ _id: -1 }).limit(100).maxTimeMS(5000).lean();
    } else {
      [products, popularProducts, discountedProducts] = await Promise.all([
        ProductModel.find({ status: "show" })
          .populate(POP_CATEGORY).populate(POP_PET).populate(POP_BRAND)
          .sort({ _id: -1 }).limit(100).maxTimeMS(5000).lean(),
        ProductModel.find({ status: "show" })
          .populate(POP_CATEGORY).populate(POP_PET).populate(POP_BRAND)
          .sort({ sales: -1 }).limit(20).maxTimeMS(5000).lean(),
        ProductModel.find({
          status: "show",
          $or: [
            { $and: [{ isCombination: true }, { variants: { $elemMatch: { discount: { $gt: "0.00" } } } }] },
            { $and: [{ isCombination: false }, { $expr: { $gt: [{ $toDouble: "$prices.discount" }, 0] } }] },
          ],
        }).populate(POP_CATEGORY).sort({ _id: -1 }).limit(20).maxTimeMS(5000).lean(),
      ]);
    }

    return { reviews, products, popularProducts, relatedProducts, discountedProducts };
  }
}
