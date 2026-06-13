import type { Order } from "../entities/Order";

/** Write-side repository for the Order aggregate. */
export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  /** Persists the aggregate's current state (status, paid). */
  save(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}
