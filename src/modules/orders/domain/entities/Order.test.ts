import { describe, it, expect } from "vitest";
import { Order } from "./Order";
import { ORDER_STATUS_CHANGED } from "../events/OrderStatusChanged";
import { ORDER_PAID } from "../events/OrderPaid";

const doc = {
  _id: "o1",
  user: "cust1",
  cart: [{ _id: "p1", quantity: 2, isCombination: false }],
  total: 150,
  status: "pedido",
  paid: false,
};

describe("Order.changeStatus", () => {
  it("records OrderStatusChanged when the status changes", () => {
    const order = Order.fromDocument({ ...doc });
    order.changeStatus("empaquetado");
    expect(order.status).toBe("empaquetado");
    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe(ORDER_STATUS_CHANGED);
  });

  it("does not record an event when the status is unchanged", () => {
    const order = Order.fromDocument({ ...doc });
    order.changeStatus("pedido");
    expect(order.pullDomainEvents()).toHaveLength(0);
  });

  it("snapshot reflects the new status", () => {
    const order = Order.fromDocument({ ...doc });
    order.changeStatus("entregado");
    expect(order.snapshot().status).toBe("entregado");
  });
});

describe("Order.confirmPayment", () => {
  it("marks paid and emits OrderPaid with mapped line items", () => {
    const order = Order.fromDocument({ ...doc });
    const r = order.confirmPayment();
    expect(r.isOk).toBe(true);
    expect(order.isPaid).toBe(true);
    const events = order.pullDomainEvents();
    expect(events[0]?.name).toBe(ORDER_PAID);
  });

  it("is idempotent: paying an already-paid order is a conflict", () => {
    const order = Order.fromDocument({ ...doc, paid: true });
    const r = order.confirmPayment();
    expect(r.isFail).toBe(true);
    expect(r.getError().code).toBe("CONFLICT");
  });
});
