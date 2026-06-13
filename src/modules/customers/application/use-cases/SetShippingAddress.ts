import { Result } from "../../../../shared/kernel/Result";
import { NotFoundError } from "../../../../shared/errors/DomainError";
import type { ICustomerRepository } from "../../domain/repositories/ICustomerRepository";

/**
 * Sets the customer's single shipping address (and phone from contact), with
 * upsert — mirrors the legacy addShippingAddress. `shippingAddress` is a single
 * embedded object in the schema, not an array.
 */
export class SetShippingAddress {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(
    customerId: string,
    address: Record<string, unknown>
  ): Promise<Result<void, NotFoundError>> {
    const { matched } = await this.customers.setShippingAddress(customerId, address);
    if (!matched) return Result.fail(new NotFoundError("Customer", customerId));
    return Result.ok(undefined);
  }
}
