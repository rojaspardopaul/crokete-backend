import { Router, type RequestHandler } from "express";
import type { CustomerController } from "./CustomerController";

export interface CustomerRouteGuards {
  isAuth: RequestHandler;
  isSuperAdmin: RequestHandler;
}

/**
 * Defines ONLY the customer routes that have been ported to DDD (profile,
 * shipping address, admin list). Mounted BEFORE the legacy customer router on
 * the same path, so any route NOT defined here (login, register, oauth, verify,
 * password, refresh, delete, broken address PUT/DELETE) falls through to legacy.
 *
 * Per-route guards mirror the legacy middlewares exactly.
 */
export function createCustomerRouter(
  controller: CustomerController,
  guards: CustomerRouteGuards
): Router {
  const router = Router();
  const { isAuth, isSuperAdmin } = guards;

  // Specific paths first
  router.post("/shipping/address/:id", isAuth, controller.setShippingAddress);
  router.get("/shipping/address/:id", isAuth, controller.getShippingAddress);

  router.get("/", isAuth, isSuperAdmin, controller.list);
  router.get("/:id", isAuth, controller.getById);
  router.put("/:id", isAuth, controller.update);

  return router;
}
