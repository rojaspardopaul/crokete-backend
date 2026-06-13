import { describe, it, expect, vi } from "vitest";
import { EventBus } from "./EventBus";
import type { DomainEvent } from "./DomainEvent";

const evt = (name: string): DomainEvent => ({ name, occurredAt: new Date() });

describe("EventBus", () => {
  it("delivers an event to all subscribers", async () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("x", a);
    bus.subscribe("x", b);

    await bus.publish(evt("x"));

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("does not deliver to handlers of other events", async () => {
    const bus = new EventBus();
    const other = vi.fn();
    bus.subscribe("y", other);

    await bus.publish(evt("x"));

    expect(other).not.toHaveBeenCalled();
  });

  it("isolates subscribers: one throwing handler does not skip the others", async () => {
    const bus = new EventBus();
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    const survivor = vi.fn();
    bus.subscribe("x", failing);
    bus.subscribe("x", survivor);

    await expect(bus.publish(evt("x"))).rejects.toBeInstanceOf(AggregateError);
    expect(survivor).toHaveBeenCalledOnce(); // ran despite the other failing
  });

  it("unsubscribe removes the handler", async () => {
    const bus = new EventBus();
    const h = vi.fn();
    const off = bus.subscribe("x", h);
    off();

    await bus.publish(evt("x"));

    expect(h).not.toHaveBeenCalled();
    expect(bus.listenerCount("x")).toBe(0);
  });
});
