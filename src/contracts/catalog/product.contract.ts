import { z, registry } from "../openapi";
import { MultiLangTextSchema, ObjectIdSchema } from "../shared";

/**
 * The legacy admin form sometimes sends array fields as a bare string (or "")
 * instead of an array. The legacy controller never validated, so to keep parity
 * these inputs coerce: "" / null / undefined -> [], a single string -> [string],
 * arrays pass through. Applied to tag / image / categories / variants.
 */
const toArray = (val: unknown): unknown => {
  if (val === "" || val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  return [val];
};
const FlexibleStringArray = z.preprocess(toArray, z.array(z.string()));
const FlexibleObjectIdArray = z.preprocess(toArray, z.array(ObjectIdSchema));
const FlexibleVariantArray = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? [] : v),
  z.array(z.record(z.string(), z.unknown()))
);

/** Hierarchical pricing block (mirrors Product.prices). */
export const PricesSchema = registry.register(
  "Prices",
  z.object({
    originalPrice: z.number(),
    price: z.number(),
    discount: z.number().optional(),
  })
);

/**
 * ProductDTO — the canonical shape returned by the catalog read endpoints.
 *
 * `.passthrough()` is intentional during the lab phase: the legacy documents
 * carry many optional marketing/structured fields (visualTags, nutritionTable,
 * …) and we guarantee response parity by not stripping unknown keys. As the
 * SaaS contract hardens, these move to explicit fields.
 */
export const ProductDTOSchema = registry.register(
  "Product",
  z
    .object({
      _id: ObjectIdSchema,
      productId: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      title: MultiLangTextSchema,
      description: MultiLangTextSchema.optional(),
      slug: z.string(),
      categories: z.array(ObjectIdSchema).optional(),
      category: ObjectIdSchema.optional(),
      pet: ObjectIdSchema.nullable().optional(),
      brand: ObjectIdSchema.nullable().optional(),
      image: z.array(z.string()).optional(),
      stock: z.number().min(0).optional(),
      sales: z.number().optional(),
      tag: z.array(z.string()).optional(),
      prices: PricesSchema,
      variants: z.array(z.record(z.string(), z.unknown())).optional(),
      isCombination: z.boolean(),
      average_rating: z.number().optional(),
      total_reviews: z.number().optional(),
      status: z.enum(["show", "hide"]).optional(),
      productType: z
        .enum(["food", "medicine", "accessory", "general"])
        .optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .passthrough()
);
export type ProductDTO = z.infer<typeof ProductDTOSchema>;

/** Input contract for creating a product (POST /products/add). */
export const CreateProductDTOSchema = registry.register(
  "CreateProduct",
  z
    .object({
      productId: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      title: MultiLangTextSchema,
      description: MultiLangTextSchema.optional(),
      slug: z.string().min(1),
      categories: FlexibleObjectIdArray.optional(),
      category: ObjectIdSchema,
      pet: ObjectIdSchema.nullable().optional(),
      brand: ObjectIdSchema.nullable().optional(),
      image: FlexibleStringArray.optional(),
      stock: z.number().min(0).optional(),
      tag: FlexibleStringArray.optional(),
      prices: PricesSchema,
      variants: FlexibleVariantArray.optional(),
      isCombination: z.boolean(),
    })
    .passthrough()
);
export type CreateProductDTO = z.infer<typeof CreateProductDTOSchema>;

/** Input contract for updating a product (PATCH /products/:id). */
export const UpdateProductDTOSchema = registry.register(
  "UpdateProduct",
  CreateProductDTOSchema.partial()
);
export type UpdateProductDTO = z.infer<typeof UpdateProductDTOSchema>;

/** Query params for the admin product list (GET /products). */
export const ListProductsQuerySchema = z.object({
  title: z.string().max(100).optional(),
  category: z.string().optional(),
  price: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

/** Paginated response for the admin product list. */
export const ListProductsResponseSchema = registry.register(
  "ListProductsResponse",
  z.object({
    products: z.array(ProductDTOSchema),
    totalDoc: z.number(),
    limits: z.number().optional(),
    pages: z.number().optional(),
  })
);
export type ListProductsResponse = z.infer<typeof ListProductsResponseSchema>;
