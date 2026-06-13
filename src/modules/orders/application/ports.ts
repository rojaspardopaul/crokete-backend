/**
 * Application ports for the admin orders side. Implemented in infrastructure
 * (Mongo read model) and at the composition boundary (status side-effects,
 * which reuse the legacy loyalty/email code).
 */

export interface ListOrdersQuery {
  day?: string;
  status?: string;
  page?: number;
  limit?: number;
  method?: string;
  startDate?: string;
  endDate?: string;
  customerName?: string;
}

/** Read model for admin order queries and dashboards (CQRS-lite). */
export interface OrderReadPort {
  getAllOrders(query: ListOrdersQuery): Promise<unknown>;
  getOrderById(id: string): Promise<unknown>;
  getOrderCustomer(customerId: string): Promise<unknown>;
  getDashboardOrders(query: { page?: number; limit?: number }): Promise<unknown>;
  getDashboardRecentOrder(query: { page?: number; limit?: number }): Promise<unknown>;
  getDashboardCount(): Promise<unknown>;
  getDashboardAmount(): Promise<unknown>;
  getBestSellerProductChart(): Promise<unknown>;
}

/**
 * Side-effects of an order status change (loyalty coupon restore, loyalty
 * points, status-update email). The production implementation reuses the legacy
 * code; tests inject a spy/no-op. Kept out of the domain because it touches
 * other contexts and external systems.
 */
export interface OrderStatusEffectsPort {
  onStatusChanged(
    order: Record<string, unknown>,
    newStatus: string,
    previousStatus: string
  ): Promise<void> | void;
}
