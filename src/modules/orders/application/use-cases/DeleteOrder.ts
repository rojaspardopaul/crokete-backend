import type { IOrderRepository } from "../../domain/repositories/IOrderRepository";

/** Mirrors legacy admin `deleteOrder`. */
export class DeleteOrder {
  constructor(private readonly orders: IOrderRepository) {}

  async execute(id: string): Promise<void> {
    await this.orders.delete(id);
  }
}
