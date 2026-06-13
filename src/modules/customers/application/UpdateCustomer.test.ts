import { describe, it, expect, vi } from "vitest";
import { Customer } from "../domain/entities/Customer";
import { UpdateCustomer } from "./use-cases/UpdateCustomer";
import type { ICustomerRepository } from "../domain/repositories/ICustomerRepository";
import type { CustomerTokenPort } from "./ports";

const tokens: CustomerTokenPort = {
  generateAccessToken: () => "ACCESS",
  generateRefreshToken: () => "REFRESH",
};

function repo(over: Partial<ICustomerRepository>): ICustomerRepository {
  return {
    findById: async () => Customer.fromDocument({ _id: "u1", name: "A", email: "a@x.com" }),
    findIdByEmail: async () => null,
    save: vi.fn(async () => {}),
    setShippingAddress: vi.fn(async () => ({ matched: true })),
    ...over,
  };
}

describe("UpdateCustomer use-case", () => {
  it("updates profile and re-issues tokens", async () => {
    const r = repo({});
    const result = await new UpdateCustomer(r, tokens).execute("u1", {
      name: "New",
      email: "new@x.com",
    });
    expect(result.isOk).toBe(true);
    const payload = result.getValue();
    expect(payload.token).toBe("ACCESS");
    expect(payload.refreshToken).toBe("REFRESH");
    expect(payload.name).toBe("New");
    expect(r.save).toHaveBeenCalledOnce();
  });

  it("rejects an email already used by another customer", async () => {
    const r = repo({ findIdByEmail: async () => "someoneElse" });
    const result = await new UpdateCustomer(r, tokens).execute("u1", {
      email: "taken@x.com",
    });
    expect(result.isFail).toBe(true);
    expect(result.getError().code).toBe("VALIDATION_ERROR");
  });

  it("allows keeping the same email (owned by self)", async () => {
    const r = repo({ findIdByEmail: async () => "u1" });
    const result = await new UpdateCustomer(r, tokens).execute("u1", {
      email: "a@x.com",
    });
    expect(result.isOk).toBe(true);
  });

  it("returns NotFound for an unknown customer", async () => {
    const r = repo({ findById: async () => null });
    const result = await new UpdateCustomer(r, tokens).execute("missing", {});
    expect(result.isFail).toBe(true);
    expect(result.getError().code).toBe("NOT_FOUND");
  });
});
