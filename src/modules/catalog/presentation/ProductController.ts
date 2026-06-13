import type { Request, Response } from "express";
import { DomainError, toHttpStatus } from "../../../shared/errors/DomainError";
import {
  CreateProductDTOSchema,
  UpdateProductDTOSchema,
} from "../../../contracts/catalog";
import type { CreateProduct } from "../application/use-cases/CreateProduct";
import type { UpdateProduct } from "../application/use-cases/UpdateProduct";
import type { ChangeProductStatus } from "../application/use-cases/ChangeProductStatus";
import type { DeleteProduct } from "../application/use-cases/DeleteProduct";
import type {
  ReplaceAllProducts,
  UpdateManyProducts,
} from "../application/use-cases/BulkProducts";
import type { CatalogReadPort } from "../application/ports";

/**
 * Thin HTTP adapter: validates input against the contract, delegates to a
 * use-case (write) or the read port (queries), maps domain errors to status
 * codes. NO business logic lives here. Response shapes match the legacy
 * controller so the admin/store keep working unchanged.
 */
export class ProductController {
  constructor(
    private readonly createProduct: CreateProduct,
    private readonly updateProductUC: UpdateProduct,
    private readonly changeStatus: ChangeProductStatus,
    private readonly deleteProductUC: DeleteProduct,
    private readonly replaceAllUC: ReplaceAllProducts,
    private readonly updateManyUC: UpdateManyProducts,
    private readonly read: CatalogReadPort
  ) {}

  add = async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateProductDTOSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send({ message: parsed.error.issues[0]?.message ?? "Invalid product" });
      return;
    }
    const result = await this.createProduct.execute(parsed.data);
    if (result.isFail) return this.fail(res, result.getError());
    res.send(result.getValue());
  };

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, category, price, page, limit } = req.query;
      const data = await this.read.listProductsAdmin({
        title: title as string | undefined,
        category: category as string | undefined,
        price: price as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  showing = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.send(await this.read.getShowingProducts());
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  store = async (req: Request, res: Response): Promise<void> => {
    try {
      const { category, title, slug, pet, brand } = req.query as Record<string, string>;
      if (title && title.length > 100) {
        res.status(400).send({ message: "Búsqueda demasiado larga (máximo 100 caracteres)." });
        return;
      }
      const user = (req as Request & { user?: { role?: string } }).user;
      const isAdmin = Boolean(user && (user.role === "Admin" || user.role === "Super Admin"));

      const { data, fromCache, ttl, bypass } = await this.read.getStoreProducts(
        { category, title, slug, pet, brand },
        isAdmin
      );

      if (bypass) {
        res.set("X-Cache", "BYPASS");
        res.set("Cache-Control", "no-store");
      } else {
        res.set("X-Cache", fromCache ? "HIT" : "MISS");
        res.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=10`);
      }
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  addAll = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.replaceAllUC.execute(req.body ?? []);
      res.status(200).send({ message: "Product Added successfully!" });
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  updateMany = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.updateManyUC.execute(req.body.ids ?? [], req.body ?? {});
      res.send({ message: "Products update successfully!" });
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.send(await this.read.getProductById(req.params.id as string));
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, fromCache, ttl } = await this.read.getProductBySlugCached(
        req.params.slug as string
      );
      res.set("X-Cache", fromCache ? "HIT" : "MISS");
      res.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=10`);
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: `Slug problem, ${(err as Error).message}` });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateProductDTOSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send({ message: parsed.error.issues[0]?.message ?? "Invalid product" });
      return;
    }
    const result = await this.updateProductUC.execute(
      req.params.id as string,
      parsed.data
    );
    if (result.isFail) return this.fail(res, result.getError());
    res.send({ data: result.getValue(), message: "Product updated successfully!" });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const status = req.body.status === "hide" ? "hide" : "show";
    const result = await this.changeStatus.execute(req.params.id as string, status);
    if (result.isFail) return this.fail(res, result.getError());
    res.status(200).send({ message: `Product ${status} Successfully!` });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.deleteProductUC.execute(req.params.id as string);
      res.status(200).send({ message: "Product Deleted Successfully!" });
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  removeMany = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.deleteProductUC.executeMany(req.body.ids ?? []);
      res.send({ message: "Products Delete Successfully!" });
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  private fail(res: Response, error: DomainError): void {
    res.status(toHttpStatus(error)).send({ message: error.message, code: error.code });
  }
}
