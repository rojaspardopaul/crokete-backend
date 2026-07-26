import { eventBus as defaultEventBus, type EventBus } from "../../shared/events/EventBus";
import { logger as defaultLogger, type Logger } from "../../shared/logger";
import { ORDER_PAID } from "./domain/events/OrderPaid";
import { MarkOrderPaid } from "./application/use-cases/MarkOrderPaid";
import type { IOrderRepository } from "./domain/repositories/IOrderRepository";

import type { InventoryPort } from "../inventory/application/InventoryPort";
import type { LoyaltyPort } from "../loyalty/application/LoyaltyPort";
import type { NotificationPort } from "../notifications/application/NotificationPort";
import { onOrderPaidDecrementStock } from "../inventory/application/handlers/onOrderPaidDecrementStock";
import { onOrderPaidGrantPoints } from "../loyalty/application/handlers/onOrderPaidGrantPoints";
import { onOrderPaidSendEmail } from "../notifications/application/handlers/onOrderPaidSendEmail";
import { PrismaInventoryAdapter } from "../inventory/infrastructure/PrismaInventoryAdapter";
import { LoggingLoyaltyAdapter } from "../loyalty/infrastructure/LoggingLoyaltyAdapter";
import { LoggingNotificationAdapter } from "../notifications/infrastructure/LoggingNotificationAdapter";

export interface OrdersModuleDeps {
  orders: IOrderRepository;
  events?: EventBus;
  logger?: Logger;
  inventory?: InventoryPort;
  loyalty?: LoyaltyPort;
  notifications?: NotificationPort;
}

/**
 * Composition root for the orders flow. Wires the MarkOrderPaid use-case and
 * SUBSCRIBES the three OrderPaid handlers (inventory, loyalty, notifications) to
 * the event bus. This is the concrete demonstration of the internal-events
 * pattern: one event, three independent reactions, no direct coupling.
 *
 * Returns an `unsubscribe` so tests can tear the wiring down between cases.
 */
export function buildOrdersModule(deps: OrdersModuleDeps): {
  markOrderPaid: MarkOrderPaid;
  unsubscribe: () => void;
} {
  const events = deps.events ?? defaultEventBus;
  const logger = deps.logger ?? defaultLogger;
  const inventory = deps.inventory ?? new PrismaInventoryAdapter();
  const loyalty = deps.loyalty ?? new LoggingLoyaltyAdapter(logger);
  const notifications =
    deps.notifications ?? new LoggingNotificationAdapter(logger);

  const offs = [
    events.subscribe(ORDER_PAID, onOrderPaidDecrementStock(inventory, logger)),
    events.subscribe(ORDER_PAID, onOrderPaidGrantPoints(loyalty, logger)),
    events.subscribe(ORDER_PAID, onOrderPaidSendEmail(notifications, logger)),
  ];

  return {
    markOrderPaid: new MarkOrderPaid(deps.orders, events),
    unsubscribe: () => offs.forEach((off) => off()),
  };
}
