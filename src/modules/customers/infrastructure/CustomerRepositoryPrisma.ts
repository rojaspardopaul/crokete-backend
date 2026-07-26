import type { ICustomerRepository } from "../domain/repositories/ICustomerRepository";
import { Customer } from "../domain/entities/Customer";
import { prisma, isUuid } from "../../../shared/prisma";
import { customerToApi } from "../../../shared/presenters";

/** Nunca se devuelve el hash de la contraseña fuera del flujo de autenticación. */
const PUBLIC = { omit: { password: true } } as const;

export class CustomerRepositoryPrisma implements ICustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    if (!isUuid(id)) return null;
    const row = await prisma().customer.findUnique({ where: { id }, ...PUBLIC });
    return row ? Customer.fromDocument(customerToApi(row)) : null;
  }

  async findIdByEmail(email: string): Promise<string | null> {
    const row = await prisma().customer.findUnique({
      where: { email: String(email || "").toLowerCase() },
      select: { id: true },
    });
    return row ? row.id : null;
  }

  async save(customer: Customer): Promise<void> {
    if (!isUuid(customer.id)) return;
    const s = customer.snapshot();

    // Sólo se escriben los campos presentes: Mongoose ignoraba las asignaciones
    // `undefined`, mientras que Prisma las guardaría como NULL.
    const data: Record<string, unknown> = {};
    if (s.name !== undefined) data.name = s.name;
    if (s.email !== undefined) {
      data.email = s.email ? String(s.email).toLowerCase() : s.email;
    }
    if (s.address !== undefined) data.address = s.address;
    if (s.phone !== undefined) data.phone = s.phone;
    if (s.image !== undefined) data.image = s.image;

    await prisma().customer.updateMany({
      where: { id: customer.id },
      data: data as never,
    });
  }

  /**
   * Reemplaza la dirección de envío (el cliente guarda una sola) y, si viene,
   * el teléfono de contacto.
   *
   * Mongo hacía `upsert: true`, que podía crear un cliente fantasma con sólo el
   * id. En Postgres `name` y `email` son obligatorios, así que no se inventa el
   * registro: se informa de que no hubo coincidencia y el controlador responde
   * 404, en vez de dejar una fila incompleta.
   */
  async setShippingAddress(
    id: string,
    address: Record<string, unknown>
  ): Promise<{ matched: boolean }> {
    if (!isUuid(id)) return { matched: false };

    const data: Record<string, unknown> = { shippingAddress: address };
    if (address.contact) data.phone = address.contact;

    const result = await prisma().customer.updateMany({
      where: { id },
      data: data as never,
    });
    return { matched: result.count > 0 };
  }
}
