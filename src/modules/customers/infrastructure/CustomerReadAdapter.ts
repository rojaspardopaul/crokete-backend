import type { CustomerReadPort } from "../application/ports";
import { CustomerModel } from "./CustomerModel";

/** Read model for customer queries (faithful to legacy controller reads). */
export class CustomerReadAdapter implements CustomerReadPort {
  async listCustomers(): Promise<unknown> {
    return CustomerModel.find({}).sort({ _id: -1 });
  }

  async getById(id: string): Promise<unknown> {
    return CustomerModel.findById(id);
  }

  async getShippingAddress(id: string): Promise<unknown> {
    const customer = (await CustomerModel.findById(id)) as
      | { shippingAddress?: unknown }
      | null;
    return { shippingAddress: customer?.shippingAddress };
  }
}
