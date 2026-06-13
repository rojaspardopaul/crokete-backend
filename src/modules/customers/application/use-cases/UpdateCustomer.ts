import { Result } from "../../../../shared/kernel/Result";
import {
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/DomainError";
import type { ICustomerRepository } from "../../domain/repositories/ICustomerRepository";
import type { CustomerTokenPort } from "../ports";

type UpdateError = NotFoundError | ValidationError;

/**
 * UpdateCustomer use-case (profile). Mirrors legacy updateCustomer: enforces
 * email uniqueness, applies the profile, persists, then RE-ISSUES tokens (the
 * JWT carries name/email so the client needs a fresh one). Token signing is
 * delegated to the injected legacy token port.
 */
export class UpdateCustomer {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly tokens: CustomerTokenPort
  ) {}

  async execute(
    id: string,
    body: { name?: string; email?: string; address?: string; phone?: string; image?: string }
  ): Promise<Result<Record<string, unknown>, UpdateError>> {
    const customer = await this.customers.findById(id);
    if (!customer) return Result.fail(new NotFoundError("Customer", id));

    if (body.email) {
      const ownerId = await this.customers.findIdByEmail(body.email);
      if (ownerId && ownerId !== id) {
        return Result.fail(new ValidationError("Email already exists."));
      }
    }

    customer.updateProfile(body);
    await this.customers.save(customer);

    const snap = customer.snapshot();
    return Result.ok({
      refreshToken: this.tokens.generateRefreshToken(snap),
      token: this.tokens.generateAccessToken(snap),
      _id: snap._id,
      name: snap.name,
      email: snap.email,
      address: snap.address,
      phone: snap.phone,
      image: snap.image,
      message: "Customer updated successfully!",
    });
  }
}
