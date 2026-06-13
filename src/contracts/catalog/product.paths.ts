import { registry, z } from "../openapi";
import { ErrorResponseSchema, ObjectIdSchema } from "../shared";
import {
  ProductDTOSchema,
  CreateProductDTOSchema,
  UpdateProductDTOSchema,
  ListProductsResponseSchema,
} from "./product.contract";

/**
 * Registers the catalog HTTP paths into the OpenAPI registry. Kept separate
 * from the schemas so the schemas can be imported by domain/test code without
 * pulling in path definitions.
 *
 * The paths mirror the EXISTING routes (routes/productRoutes.js) so the
 * generated clients hit the same URLs the admin/store already use.
 */
export function registerProductPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/products",
    tags: ["Catalog"],
    summary: "List products (admin, paginated)",
    request: {
      query: z.object({
        title: z.string().max(100).optional(),
        category: z.string().optional(),
        price: z.string().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated product list",
        content: {
          "application/json": { schema: ListProductsResponseSchema },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/products/product/{slug}",
    tags: ["Catalog"],
    summary: "Get a single product by slug",
    request: {
      params: z.object({ slug: z.string() }),
    },
    responses: {
      200: {
        description: "Product",
        content: { "application/json": { schema: ProductDTOSchema } },
      },
      500: {
        description: "Error",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/products/add",
    tags: ["Catalog"],
    summary: "Create a product",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateProductDTOSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Created product",
        content: { "application/json": { schema: ProductDTOSchema } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/products/{id}",
    tags: ["Catalog"],
    summary: "Update a product",
    request: {
      params: z.object({ id: ObjectIdSchema }),
      body: {
        content: {
          "application/json": { schema: UpdateProductDTOSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Updated product",
        content: {
          "application/json": {
            schema: z.object({
              data: ProductDTOSchema,
              message: z.string(),
            }),
          },
        },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/products/{id}",
    tags: ["Catalog"],
    summary: "Delete a product",
    request: { params: z.object({ id: ObjectIdSchema }) },
    responses: {
      200: {
        description: "Deleted",
        content: {
          "application/json": { schema: z.object({ message: z.string() }) },
        },
      },
    },
  });
}
