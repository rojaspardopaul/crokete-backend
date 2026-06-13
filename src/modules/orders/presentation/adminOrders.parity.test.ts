import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { buildAdminOrdersModule } from "../AdminOrdersModule";
import { EventBus } from "../../../shared/events/EventBus";
import { Order } from "../domain/entities/Order";
import type { IOrderRepository } from "../domain/repositories/IOrderRepository";
import type { OrderReadPort, OrderStatusEffectsPort } from "../application/ports";

function fakeRead(): OrderReadPort {
  return {
    getAllOrders: vi.fn(async () => ({ orders: [{ _id: "o1" }], limits: 10, pages: 1, totalDoc: 1, methodTotals: [] })),
    getOrderById: vi.fn(async (id: string) => ({ _id: id })),
    getOrderCustomer: vi.fn(async () => [{ _id: "o1" }]),
    getDashboardOrders: vi.fn(async () => ({ totalOrder: 1, orders: [] })),
    getDashboardRecentOrder: vi.fn(async () => ({ orders: [], totalOrder: 1 })),
    getDashboardCount: vi.fn(async () => ({ totalOrder: 1, totalPendingOrder: 0 })),
    getDashboardAmount: vi.fn(async () => ({ totalAmount: 0 })),
    getBestSellerProductChart: vi.fn(async () => ({ totalDoc: 1, bestSellingProduct: [] })),
  };
}

class InMemoryOrderRepo implements IOrderRepository {
  private store = new Map<string, Record<string, unknown>>();
  seed(doc: Record<string, unknown>) {
    this.store.set(String(doc._id), doc);
  }
  async findById(id: string) {
    const doc = this.store.get(id);
    return doc ? Order.fromDocument(doc) : null;
  }
  async save(order: Order) {
    this.store.set(order.id, order.snapshot());
  }
  async delete(id: string) {
    this.store.delete(id);
  }
  count() {
    return this.store.size;
  }
}

describe("admin orders router (HTTP parity)", () => {
  let app: Express;
  let repo: InMemoryOrderRepo;
  let effects: OrderStatusEffectsPort;

  beforeEach(() => {
    repo = new InMemoryOrderRepo();
    repo.seed({ _id: "650000000000000000000001", user: "c1", status: "pedido", cart: [] });
    effects = { onStatusChanged: vi.fn() };
    const { router } = buildAdminOrdersModule({
      orders: repo,
      read: fakeRead(),
      effects,
      events: new EventBus(),
    });
    app = express();
    app.use(express.json());
    app.use("/orders", router);
  });

  it("GET / returns the paginated admin shape", async () => {
    const res = await request(app).get("/orders?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalDoc: 1, pages: 1 });
  });

  it("GET /dashboard-count returns counts", async () => {
    const res = await request(app).get("/orders/dashboard-count");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalOrder");
  });

  it("GET /:id returns an order", async () => {
    const res = await request(app).get("/orders/650000000000000000000001");
    expect(res.status).toBe(200);
    expect(res.body._id).toBe("650000000000000000000001");
  });

  it("PUT /:id updates status and runs side effects", async () => {
    const res = await request(app)
      .put("/orders/650000000000000000000001")
      .send({ status: "empaquetado" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("¡Pedido actualizado correctamente!");
    expect(effects.onStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: "empaquetado" }),
      "empaquetado",
      "pedido"
    );
  });

  it("PUT /:id rejects an invalid status with 400", async () => {
    const res = await request(app)
      .put("/orders/650000000000000000000001")
      .send({ status: "not-a-status" });
    expect(res.status).toBe(400);
  });

  it("PUT /:id returns 404 for an unknown order", async () => {
    const res = await request(app)
      .put("/orders/650000000000000000000099")
      .send({ status: "entregado" });
    expect(res.status).toBe(404);
  });

  it("DELETE /:id removes the order", async () => {
    const res = await request(app).delete("/orders/650000000000000000000001");
    expect(res.status).toBe(200);
    expect(repo.count()).toBe(0);
  });
});

describe("admin orders router (guard)", () => {
  it("applies the guard to every route", async () => {
    const { router } = buildAdminOrdersModule({
      orders: new InMemoryOrderRepo(),
      read: fakeRead(),
      effects: { onStatusChanged: vi.fn() },
      events: new EventBus(),
      guard: [(_req, res) => res.status(403).send({ message: "forbidden" })],
    });
    const app = express();
    app.use(express.json());
    app.use("/orders", router);

    expect((await request(app).get("/orders")).status).toBe(403);
    expect((await request(app).get("/orders/dashboard-count")).status).toBe(403);
    expect((await request(app).delete("/orders/x")).status).toBe(403);
  });
});
