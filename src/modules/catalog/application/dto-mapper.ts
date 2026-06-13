import type {
  ProductCreateInput,
  ProductReferences,
} from "../domain/entities/Product";

/** Keys that map to domain reference fields rather than to `extra`. */
const REFERENCE_KEYS = ["category", "categories", "pet", "brand"] as const;

/** Core keys consumed explicitly by the aggregate (kept out of `extra`). */
const CORE_KEYS = new Set<string>([
  "productId",
  "sku",
  "barcode",
  "title",
  "description",
  "slug",
  "prices",
  "stock",
  "isCombination",
  "image",
  "tag",
  "variants",
  "_id",
  ...REFERENCE_KEYS,
]);

/**
 * Splits a validated contract DTO into the shape the Product aggregate expects:
 * core fields, references, and an opaque `extra` bag for the extended
 * marketing/structured fields. This keeps the aggregate focused while
 * preserving full response parity with the legacy document.
 */
export function toProductCreateInput(
  dto: Record<string, unknown>
): ProductCreateInput {
  const references: ProductReferences = {};
  for (const key of REFERENCE_KEYS) {
    if (dto[key] !== undefined) {
      (references as Record<string, unknown>)[key] = dto[key];
    }
  }

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (!CORE_KEYS.has(key)) extra[key] = value;
  }

  return {
    productId: dto.productId as string | undefined,
    sku: dto.sku as string | undefined,
    barcode: dto.barcode as string | undefined,
    title: dto.title as Record<string, string>,
    description: dto.description as Record<string, string> | undefined,
    slug: dto.slug as string,
    prices: dto.prices as ProductCreateInput["prices"],
    stock: dto.stock as number | undefined,
    isCombination: Boolean(dto.isCombination),
    image: dto.image as string[] | undefined,
    tag: dto.tag as string[] | undefined,
    variants: dto.variants as Record<string, unknown>[] | undefined,
    references,
    extra,
  };
}
