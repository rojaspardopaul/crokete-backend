import { describe, it, expect } from "vitest";
import { Customer } from "./Customer";

describe("Customer aggregate", () => {
  it("applies a profile update onto the snapshot", () => {
    const c = Customer.fromDocument({ _id: "u1", name: "Old", email: "old@x.com" });
    c.updateProfile({ name: "New", email: "new@x.com", phone: "555" });
    const snap = c.snapshot();
    expect(snap.name).toBe("New");
    expect(snap.email).toBe("new@x.com");
    expect(snap.phone).toBe("555");
  });

  it("exposes the current email", () => {
    const c = Customer.fromDocument({ _id: "u1", email: "a@x.com" });
    expect(c.email).toBe("a@x.com");
  });
});
