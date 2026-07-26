import type { CustomerReadPort } from "../application/ports";
import { prisma, isUuid } from "../../../shared/prisma";
import { customerToApi } from "../../../shared/presenters";

/** Las lecturas nunca exponen el hash de la contraseña. */
const PUBLIC = { omit: { password: true } } as const;

/** Read model for customer queries (faithful to legacy controller reads). */
export class CustomerReadAdapterPrisma implements CustomerReadPort {
  async listCustomers(): Promise<unknown> {
    const rows = await prisma().customer.findMany({
      orderBy: { createdAt: "desc" },
      ...PUBLIC,
    });
    return rows.map((r) => customerToApi(r));
  }

  async getById(id: string): Promise<unknown> {
    if (!isUuid(id)) return null;
    const row = await prisma().customer.findUnique({ where: { id }, ...PUBLIC });
    return row ? customerToApi(row) : null;
  }

  async getShippingAddress(id: string): Promise<unknown> {
    if (!isUuid(id)) return { shippingAddress: undefined };
    const customer = await prisma().customer.findUnique({
      where: { id },
      select: { shippingAddress: true },
    });
    return { shippingAddress: customer?.shippingAddress ?? undefined };
  }
}
