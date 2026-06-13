import { Product, type ProductProps } from "../../domain/entities/Product";
import { MultiLangText } from "../../domain/value-objects/MultiLangText";
import { Slug } from "../../domain/value-objects/Slug";
import { Price } from "../../domain/value-objects/Price";

/** Keys explicitly modelled by the aggregate (everything else is `extra`). */
const MODELLED_KEYS = new Set<string>([
  "_id", "__v", "productId", "sku", "barcode", "title", "description", "slug",
  "prices", "stock", "sales", "status", "isCombination", "image", "tag",
  "variants", "category", "categories", "pet", "brand",
]);

/**
 * Translates between the Mongoose persistence document and the Product
 * aggregate. The domain stays free of Mongoose; persistence stays free of VOs.
 */
export const ProductMapper = {
  toDomain(doc: Record<string, unknown>): Product {
    const id = String(doc._id);

    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
      if (!MODELLED_KEYS.has(key)) extra[key] = value;
    }

    const props: ProductProps = {
      productId: doc.productId as string | undefined,
      sku: doc.sku as string | undefined,
      barcode: doc.barcode as string | undefined,
      title: MultiLangText.fromPersistence(doc.title as Record<string, string>),
      description: doc.description
        ? MultiLangText.fromPersistence(doc.description as Record<string, string>)
        : undefined,
      slug: Slug.fromPersistence(doc.slug as string),
      prices: Price.fromPersistence(
        (doc.prices as { originalPrice?: number; price?: number; discount?: number }) ?? {}
      ),
      stock: (doc.stock as number) ?? 0,
      sales: (doc.sales as number) ?? 0,
      status: ((doc.status as string) ?? "show") as ProductProps["status"],
      isCombination: Boolean(doc.isCombination),
      image: (doc.image as string[]) ?? [],
      tag: (doc.tag as string[]) ?? [],
      variants: (doc.variants as Record<string, unknown>[]) ?? [],
      references: {
        category: doc.category ? String(doc.category) : undefined,
        categories: Array.isArray(doc.categories)
          ? (doc.categories as unknown[]).map(String)
          : undefined,
        pet: doc.pet ? String(doc.pet) : (doc.pet as null | undefined),
        brand: doc.brand ? String(doc.brand) : (doc.brand as null | undefined),
      },
      extra,
    };

    return Product.rehydrate(id, props);
  },

  /** Produces a plain object suitable for Mongoose insert/update. */
  toPersistence(product: Product): Record<string, unknown> {
    const p = product.props_;
    return {
      _id: product.id,
      productId: p.productId,
      sku: p.sku,
      barcode: p.barcode,
      title: p.title.toObject(),
      description: p.description?.toObject(),
      slug: p.slug.value,
      prices: p.prices.toObject(),
      stock: p.stock,
      sales: p.sales,
      status: p.status,
      isCombination: p.isCombination,
      image: p.image,
      tag: p.tag,
      variants: p.variants,
      category: p.references.category,
      categories: p.references.categories,
      pet: p.references.pet,
      brand: p.references.brand,
      ...p.extra,
    };
  },
};
