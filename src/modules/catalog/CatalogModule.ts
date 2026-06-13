import { Router } from "express";
import { eventBus as defaultEventBus, type EventBus } from "../../shared/events/EventBus";
import type { IProductRepository } from "./domain/repositories/IProductRepository";
import type { CatalogCachePort, CatalogReadPort } from "./application/ports";
import { CreateProduct } from "./application/use-cases/CreateProduct";
import { UpdateProduct } from "./application/use-cases/UpdateProduct";
import { ChangeProductStatus } from "./application/use-cases/ChangeProductStatus";
import { DeleteProduct } from "./application/use-cases/DeleteProduct";
import {
  ReplaceAllProducts,
  UpdateManyProducts,
} from "./application/use-cases/BulkProducts";
import { ProductController } from "./presentation/ProductController";
import { createProductRouter } from "./presentation/productRoutes";
import { ProductRepositoryMongo } from "./infrastructure/repositories/ProductRepositoryMongo";
import { CacheService } from "./infrastructure/cache/CacheService";
import type { CachePort } from "./infrastructure/cache/CachePort";
import { CatalogCacheAdapter } from "./infrastructure/cache/CatalogCacheAdapter";
import { CatalogReadAdapter } from "./infrastructure/read/CatalogReadAdapter";

export interface CatalogModuleDeps {
  products?: IProductRepository;
  /**
   * Shared low-level cache. In production inject the app's legacy utils/cache so
   * the TS module and legacy controllers invalidate the SAME store. Defaults to
   * a fresh in-module CacheService (used by tests).
   */
  cacheService?: CachePort;
  cache?: CatalogCachePort;
  read?: CatalogReadPort;
  events?: EventBus;
}

/**
 * Composition root for the catalog module: wires domain → application →
 * infrastructure → presentation and returns an Express Router plus the
 * use-cases (handy for tests). Dependencies are overridable so tests can inject
 * in-memory fakes without a database.
 *
 * To put this in front of production traffic, replace in api/index.js:
 *   const productRoutes = require("../routes/productRoutes");
 * with the compiled output of buildCatalogModule().router. Until then the
 * legacy router stays mounted (zero production impact).
 */
export function buildCatalogModule(deps: CatalogModuleDeps = {}): {
  router: Router;
  useCases: {
    createProduct: CreateProduct;
    updateProduct: UpdateProduct;
    changeStatus: ChangeProductStatus;
    deleteProduct: DeleteProduct;
    replaceAll: ReplaceAllProducts;
    updateMany: UpdateManyProducts;
  };
} {
  const events = deps.events ?? defaultEventBus;
  const products = deps.products ?? new ProductRepositoryMongo();

  // Cache + read share one low-level cache (injected in production).
  const cacheService = deps.cacheService ?? new CacheService();
  const cache = deps.cache ?? new CatalogCacheAdapter(cacheService);
  const read = deps.read ?? new CatalogReadAdapter(cacheService);

  const createProduct = new CreateProduct(products, cache, events);
  const updateProduct = new UpdateProduct(products, cache);
  const changeStatus = new ChangeProductStatus(products, cache);
  const deleteProduct = new DeleteProduct(products, cache);
  const replaceAll = new ReplaceAllProducts(products, cache);
  const updateMany = new UpdateManyProducts(products, cache);

  const controller = new ProductController(
    createProduct,
    updateProduct,
    changeStatus,
    deleteProduct,
    replaceAll,
    updateMany,
    read
  );

  return {
    router: createProductRouter(controller),
    useCases: {
      createProduct,
      updateProduct,
      changeStatus,
      deleteProduct,
      replaceAll,
      updateMany,
    },
  };
}
