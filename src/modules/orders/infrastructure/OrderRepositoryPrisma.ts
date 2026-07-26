import type { IOrderRepository } from "../domain/repositories/IOrderRepository";
import { Order } from "../domain/entities/Order";
import { prisma, isUuid } from "../../../shared/prisma";
import { orderToApi } from "../../../shared/presenters";

/**
 * Repositorio de escritura del pedido sobre Postgres.
 *
 * El agregado se rehidrata desde la forma heredada del pedido (`_id`, `cart`,
 * `user`), que es la que consumen sus efectos secundarios —lealtad y correos—,
 * de modo que el dominio no necesita conocer el esquema normalizado.
 */
export class OrderRepositoryPrisma implements IOrderRepository {
  async findById(id: string): Promise<Order | null> {
    if (!isUuid(id)) return null;
    const row = await prisma().order.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? Order.fromDocument(orderToApi(row)) : null;
  }

  /**
   * Persists only the mutable fields the aggregate owns (status, paid), like the
   * legacy `Order.updateOne({_id},{ $set: { status } })` — never rewrites the
   * whole document.
   */
  async save(order: Order): Promise<void> {
    if (!isUuid(order.id)) return;
    const snap = order.snapshot();
    await prisma().order.updateMany({
      where: { id: order.id },
      data: {
        status: snap.status as never,
        paid: Boolean(snap.paid ?? order.isPaid),
      },
    });
  }

  async delete(id: string): Promise<void> {
    if (!isUuid(id)) return;
    // Las líneas caen en cascada; pagos y puntos conservan su historia con la
    // referencia en NULL.
    await prisma().order.deleteMany({ where: { id } });
  }
}
