import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../../shared/events/EventBus";
import { Order } from "../domain/entities/Order";
import { ORDER_STATUS_CHANGED } from "../domain/events/OrderStatusChanged";
import { UpdateOrderStatus } from "./use-cases/UpdateOrderStatus";
import type { IOrderRepository } from "../domain/repositories/IOrderRepository";
import type { OrderStatusEffectsPort } from "./ports";

function repoWith(order: Order | null): IOrderRepository {
  return {
    findById: async () => order,
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
}

const baseDoc = {
  _id: "o1",
  user: "cust1",
  cart: [{ _id: "p1", quantity: 1 }],
  total: 100,
  status: "pedido",
};

describe("UpdateOrderStatus use-case", () => {
  it("changes status, runs side effects and publishes the event", async () => {
    const order = Order.fromDocument({ ...baseDoc });
    const repo: IOrderRepository = {
      findById: async () => order,
      save: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    };
    const effects: OrderStatusEffectsPort = { onStatusChanged: vi.fn() };
    const bus = new EventBus();
    const onChanged = vi.fn();
    bus.subscribe(ORDER_STATUS_CHANGED, onChanged);

    const result = await new UpdateOrderStatus(repo, effects, bus).execute(
      "o1",
      "empaquetado"
    );

    expect(result.isOk).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
    expect(effects.onStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: "empaquetado" }),
      "empaquetado",
      "pedido"
    );
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("returns NotFound for an unknown order", async () => {
    const effects: OrderStatusEffectsPort = { onStatusChanged: vi.fn() };
    const result = await new UpdateOrderStatus(
      repoWith(null),
      effects,
      new EventBus()
    ).execute("missing", "entregado");
    expect(result.isFail).toBe(true);
    expect(result.getError().code).toBe("NOT_FOUND");
    expect(effects.onStatusChanged).not.toHaveBeenCalled();
  });
});
