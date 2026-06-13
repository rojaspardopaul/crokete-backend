import { Router, type RequestHandler } from "express";
import type { AdminOrderController } from "./AdminOrderController";

/**
 * Admin order routes (/v1/orders) — mirrors the legacy routes/orderRoutes.js.
 * Every route is admin-only; `guard` (e.g. [isAdmin]) is applied to all of them.
 * Specific paths are registered before parameterised ones (/dashboard before /:id).
 */
export function createAdminOrderRouter(
  controller: AdminOrderController,
  guard: RequestHandler[] = []
): Router {
  const router = Router();

  router.get("/", ...guard, controller.list);
  router.get("/dashboard", ...guard, controller.dashboard);
  router.get("/dashboard-recent-order", ...guard, controller.dashboardRecent);
  router.get("/dashboard-count", ...guard, controller.dashboardCount);
  router.get("/dashboard-amount", ...guard, controller.dashboardAmount);
  router.get("/best-seller/chart", ...guard, controller.bestSeller);
  router.get("/customer/:id", ...guard, controller.getCustomer);
  router.get("/:id", ...guard, controller.getById);
  router.put("/:id", ...guard, controller.update);
  router.delete("/:id", ...guard, controller.remove);

  return router;
}
