import type { InventoryPort } from "../application/InventoryPort";
import type { OrderLineItem } from "../../orders/domain/events/OrderPaid";

interface StockController {
  handleProductQuantity(cart: unknown[]): Promise<void>;
}

function stockController(): StockController {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("../../../../lib/stock-controller/others") as StockController;
}

/**
 * Descuento de inventario sobre Postgres.
 *
 * Delega en lib/stock-controller, que ya resuelve el descuento en una sola
 * sentencia con GREATEST(0, …) dentro de una transacción: dos pedidos
 * simultáneos del mismo producto no pueden dejar el stock negativo. Tener aquí
 * una segunda implementación significaría dos reglas de inventario distintas
 * según qué módulo procese el pedido.
 */
export class PrismaInventoryAdapter implements InventoryPort {
  async decrementForOrder(items: OrderLineItem[]): Promise<void> {
    if (!items?.length) return;
    await stockController().handleProductQuantity(items);
  }
}
