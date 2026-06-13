import { Router } from "express";
import type { ICustomerRepository } from "./domain/repositories/ICustomerRepository";
import type { CustomerReadPort, CustomerTokenPort } from "./application/ports";
import { UpdateCustomer } from "./application/use-cases/UpdateCustomer";
import { SetShippingAddress } from "./application/use-cases/SetShippingAddress";
import { CustomerController } from "./presentation/CustomerController";
import {
  createCustomerRouter,
  type CustomerRouteGuards,
} from "./presentation/customerRoutes";
import { CustomerRepositoryMongo } from "./infrastructure/CustomerRepositoryMongo";
import { CustomerReadAdapter } from "./infrastructure/CustomerReadAdapter";

export interface CustomersModuleDeps {
  /** Token signing (inject legacy config/auth generateAccess/RefreshToken). */
  tokens: CustomerTokenPort;
  /** Route guards (inject legacy config/auth isAuth, isSuperAdmin). */
  guards: CustomerRouteGuards;
  repo?: ICustomerRepository;
  read?: CustomerReadPort;
}

/**
 * Composition root for the ported customer routes (profile, shipping address,
 * admin list). Returns a router meant to be mounted BEFORE the legacy customer
 * router on /v1/customer; everything else (all auth flows) falls through to
 * legacy untouched.
 */
export function buildCustomersModule(deps: CustomersModuleDeps): {
  router: Router;
  useCases: { updateCustomer: UpdateCustomer; setShippingAddress: SetShippingAddress };
} {
  const repo = deps.repo ?? new CustomerRepositoryMongo();
  const read = deps.read ?? new CustomerReadAdapter();

  const updateCustomer = new UpdateCustomer(repo, deps.tokens);
  const setShippingAddress = new SetShippingAddress(repo);

  const controller = new CustomerController(updateCustomer, setShippingAddress, read);

  return {
    router: createCustomerRouter(controller, deps.guards),
    useCases: { updateCustomer, setShippingAddress },
  };
}
