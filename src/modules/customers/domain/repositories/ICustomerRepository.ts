import type { Customer } from "../entities/Customer";

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  /** Returns the id of the customer owning this email, or null. */
  findIdByEmail(email: string): Promise<string | null>;
  /** Persists the profile fields the aggregate owns. */
  save(customer: Customer): Promise<void>;
  /**
   * Sets (replaces) the single shippingAddress and optionally the phone, with
   * upsert — mirrors the legacy addShippingAddress.
   */
  setShippingAddress(
    id: string,
    address: Record<string, unknown>
  ): Promise<{ matched: boolean }>;
}
