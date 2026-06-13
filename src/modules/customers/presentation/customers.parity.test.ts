import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import { buildCustomersModule } from "../CustomersModule";
import { Customer } from "../domain/entities/Customer";
import type { ICustomerRepository } from "../domain/repositories/ICustomerRepository";
import type { CustomerReadPort } from "../application/ports";

const passAuth: RequestHandler = (req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = { _id: "u1" };
  next();
};
const passSuperAdmin: RequestHandler = (_req, _res, next) => next();

function fakeRead(): CustomerReadPort {
  return {
    listCustomers: vi.fn(async () => [{ _id: "u1" }, { _id: "u2" }]),
    getById: vi.fn(async (id: string) => ({ _id: id, name: "A" })),
    getShippingAddress: vi.fn(async () => ({ shippingAddress: { calle: "X" } })),
  };
}

class InMemoryCustomerRepo implements ICustomerRepository {
  private store = new Map<string, Record<string, unknown>>();
  seed(doc: Record<string, unknown>) {
    this.store.set(String(doc._id), doc);
  }
  async findById(id: string) {
    const d = this.store.get(id);
    return d ? Customer.fromDocument(d) : null;
  }
  async findIdByEmail(email: string) {
    for (const [id, d] of this.store) if (d.email === email) return id;
    return null;
  }
  async save(customer: Customer) {
    this.store.set(customer.id, customer.snapshot());
  }
  async setShippingAddress(id: string, address: Record<string, unknown>) {
    const d = this.store.get(id);
    if (!d) return { matched: false };
    d.shippingAddress = address;
    return { matched: true };
  }
}

describe("customers router (ported routes + fall-through)", () => {
  let app: Express;
  let repo: InMemoryCustomerRepo;

  beforeEach(() => {
    repo = new InMemoryCustomerRepo();
    repo.seed({ _id: "650000000000000000000001", name: "A", email: "a@x.com" });

    const { router } = buildCustomersModule({
      repo,
      read: fakeRead(),
      tokens: {
        generateAccessToken: () => "ACCESS",
        generateRefreshToken: () => "REFRESH",
      },
      guards: { isAuth: passAuth, isSuperAdmin: passSuperAdmin },
    });

    app = express();
    app.use(express.json());
    // TS router first, then a legacy stub to prove fall-through
    app.use("/customer", router);
    const legacy = express.Router();
    legacy.post("/login", (_req, res) => res.send({ from: "legacy-login" }));
    app.use("/customer", legacy);
  });

  it("GET / lists customers", async () => {
    const res = await request(app).get("/customer");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET /:id returns a customer", async () => {
    const res = await request(app).get("/customer/abc");
    expect(res.status).toBe(200);
    expect(res.body._id).toBe("abc");
  });

  it("PUT /:id updates and returns a fresh token payload", async () => {
    const res = await request(app)
      .put("/customer/650000000000000000000001")
      .send({ name: "New", email: "new@x.com" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe("ACCESS");
    expect(res.body.name).toBe("New");
  });

  it("PUT /:id rejects a duplicate email with 400", async () => {
    repo.seed({ _id: "650000000000000000000002", name: "B", email: "taken@x.com" });
    const res = await request(app)
      .put("/customer/650000000000000000000001")
      .send({ email: "taken@x.com" });
    expect(res.status).toBe(400);
  });

  it("POST /shipping/address/:id stores the shipping address", async () => {
    const res = await request(app)
      .post("/customer/shipping/address/650000000000000000000001")
      .send({ calle: "Reforma", contact: "555" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/shipping address/i);
  });

  it("GET /shipping/address/:id returns the address", async () => {
    const res = await request(app).get("/customer/shipping/address/x");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("shippingAddress");
  });

  it("falls through to legacy for non-ported routes (POST /login)", async () => {
    const res = await request(app).post("/customer/login").send({});
    expect(res.status).toBe(200);
    expect(res.body.from).toBe("legacy-login");
  });
});
