import type { Request, Response } from "express";
import { DomainError, toHttpStatus } from "../../../shared/errors/DomainError";
import type { UpdateCustomer } from "../application/use-cases/UpdateCustomer";
import type { SetShippingAddress } from "../application/use-cases/SetShippingAddress";
import type { CustomerReadPort } from "../application/ports";

/**
 * Thin HTTP adapter for the ported customer routes (profile, shipping address,
 * admin list). Auth routes are NOT here — they fall through to the legacy
 * router. Response shapes match the legacy controller.
 */
export class CustomerController {
  constructor(
    private readonly updateCustomerUC: UpdateCustomer,
    private readonly setShippingUC: SetShippingAddress,
    private readonly read: CustomerReadPort
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.send(await this.read.listCustomers());
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      res.send(await this.read.getById(req.params.id as string));
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updateCustomerUC.execute(req.params.id as string, {
      name: req.body.name,
      email: req.body.email,
      address: req.body.address,
      phone: req.body.phone,
      image: req.body.image,
    });
    if (result.isFail) {
      const err = result.getError() as DomainError;
      res.status(toHttpStatus(err)).send({ message: err.message });
      return;
    }
    res.send(result.getValue());
  };

  setShippingAddress = async (req: Request, res: Response): Promise<void> => {
    const result = await this.setShippingUC.execute(req.params.id as string, req.body);
    if (result.isFail) {
      res.status(404).send({ message: "Customer not found." });
      return;
    }
    res.send({ message: "Shipping address added or updated successfully." });
  };

  getShippingAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      res.send(await this.read.getShippingAddress(req.params.id as string));
    } catch (err) {
      res.status(500).send({ message: (err as Error).message });
    }
  };
}
