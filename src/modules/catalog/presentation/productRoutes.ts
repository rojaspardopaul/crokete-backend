import { Router, type RequestHandler } from "express";
import type { ProductController } from "./ProductController";

/**
 * Express routes for the catalog module. URLs are identical to the legacy
 * routes/productRoutes.js so admin/store consumers are unaffected when this
 * router replaces the legacy one. Full endpoint parity.
 *
 * `adminGuard` (e.g. [isAuth, isAdmin]) is applied ONLY to mutating routes.
 * Public reads (show, store, list, by-slug, getById) stay open, matching the
 * legacy behaviour plus the new auth fix.
 */
export function createProductRouter(
  controller: ProductController,
  adminGuard: RequestHandler[] = []
): Router {
  const router = Router();

  // Specific paths must be registered before parameterised ones (e.g. /add
  // before /:id) or "/add" would match the ":id" route.
  router.post("/add", ...adminGuard, controller.add);
  router.post("/all", ...adminGuard, controller.addAll);
  router.patch("/update/many", ...adminGuard, controller.updateMany);
  router.patch("/delete/many", ...adminGuard, controller.removeMany);

  // Public reads
  router.get("/show", controller.showing);
  router.get("/store", controller.store);
  router.get("/", controller.list);
  router.get("/product/:slug", controller.getBySlug);
  router.post("/:id", controller.getById);

  // Admin-only mutations on a single resource
  router.patch("/:id", ...adminGuard, controller.update);
  router.put("/status/:id", ...adminGuard, controller.updateStatus);
  router.delete("/:id", ...adminGuard, controller.remove);

  return router;
}
