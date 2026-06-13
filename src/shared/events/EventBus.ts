import type { DomainEvent } from "./DomainEvent";

export type EventHandler<E extends DomainEvent = DomainEvent> = (
  event: E
) => void | Promise<void>;

/**
 * In-memory event bus. Deliberately NOT Kafka/RabbitMQ — the architecture is a
 * modular monolith, so a process-local bus is enough and keeps the ops surface
 * tiny for a small team.
 *
 * Contract:
 *  - `publish` awaits all handlers (so an HTTP request that triggers OrderPaid
 *    can know stock/loyalty/email side-effects completed before responding, if
 *    it chooses to await).
 *  - A throwing handler does NOT prevent the other handlers from running; its
 *    error is collected and surfaced after all handlers settle. This isolates
 *    subscribers from each other (a failing email must not skip stock decrement).
 */
export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe<E extends DomainEvent>(
    eventName: string,
    handler: EventHandler<E>
  ): () => void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(eventName, list);
    // Return an unsubscribe function (handy in tests).
    return () => {
      const current = this.handlers.get(eventName) ?? [];
      this.handlers.set(
        eventName,
        current.filter((h) => h !== handler)
      );
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const list = this.handlers.get(event.name) ?? [];
    const errors: unknown[] = [];

    await Promise.all(
      list.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          errors.push(err);
        }
      })
    );

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `${errors.length} handler(s) failed for event "${event.name}"`
      );
    }
  }

  /** Number of subscribers for an event (used in tests/diagnostics). */
  listenerCount(eventName: string): number {
    return (this.handlers.get(eventName) ?? []).length;
  }
}

/**
 * Process-wide singleton used by the running app. Tests instantiate their own
 * `new EventBus()` for isolation.
 */
export const eventBus = new EventBus();
