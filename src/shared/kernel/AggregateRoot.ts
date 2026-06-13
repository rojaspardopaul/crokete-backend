import { Entity } from "./Entity";
import type { DomainEvent } from "../events/DomainEvent";

/**
 * An Aggregate Root is the only entity in an aggregate that the outside world
 * may reference. It records domain events as the aggregate changes; the
 * application layer pulls them with `pullDomainEvents()` after persistence and
 * dispatches them on the EventBus.
 */
export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Returns and clears the buffered events (call after a successful save). */
  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }
}
