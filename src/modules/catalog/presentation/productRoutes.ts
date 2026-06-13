import { Router } from "express";
import type { ProductController } from "./ProductController";

/**
 * Express routes for the catalog module. URLs are identical to the legacy
 * routes/productRoutes.js so admin/store consumers are unaffected when this
 * router replaces the legacy one. Full endpoint parity.
 *
 * NOTE: protect /add, /all, /:id (mutations), /update/many and /delete/many with
 * the existing isAuth/isAdmin middleware when mounting in api/index.js (the
 * legacy router relied on app-level guards).
 */
export function createProductRouter(controller: ProductController): Router {
  const router = Router();

  router.post("/add", controller.add);
  router.post("/all", controller.addAll);
  router.get("/show", controller.showing);
  router.get("/store", controller.store);
  router.get("/", controller.list);
  router.get("/product/:slug", controller.getBySlug);
  router.post("/:id", controller.getById);
  router.patch("/update/many", controller.updateMany);
  router.patch("/delete/many", controller.removeMany);
  router.patch("/:id", controller.update);
  router.put("/status/:id", controller.updateStatus);
  router.delete("/:id", controller.remove);

  return router;
}
