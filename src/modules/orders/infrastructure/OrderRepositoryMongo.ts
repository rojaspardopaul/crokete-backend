import mongoose from "mongoose";
import type { IOrderRepository } from "../domain/repositories/IOrderRepository";
import { Order } from "../domain/entities/Order";
import { OrderModel } from "./OrderModel";

export class OrderRepositoryMongo implements IOrderRepository {
  async findById(id: string): Promise<Order | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await OrderModel.findById(id).lean();
    return doc ? Order.fromDocument(doc as Record<string, unknown>) : null;
  }

  /**
   * Persists only the mutable fields the aggregate owns (status, paid), like the
   * legacy `Order.updateOne({_id},{ $set: { status } })` — never rewrites the
   * whole document.
   */
  async save(order: Order): Promise<void> {
    const snap = order.snapshot();
    await OrderModel.updateOne(
      { _id: order.id },
      { $set: { status: snap.status, paid: snap.paid ?? order.isPaid } }
    );
  }

  async delete(id: string): Promise<void> {
    await OrderModel.deleteOne({ _id: id });
  }
}
