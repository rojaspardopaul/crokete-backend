import mongoose from "mongoose";
import type { ICustomerRepository } from "../domain/repositories/ICustomerRepository";
import { Customer } from "../domain/entities/Customer";
import { CustomerModel } from "./CustomerModel";

export class CustomerRepositoryMongo implements ICustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await CustomerModel.findById(id).lean();
    return doc ? Customer.fromDocument(doc as Record<string, unknown>) : null;
  }

  async findIdByEmail(email: string): Promise<string | null> {
    const doc = await CustomerModel.findOne({ email }).select("_id").lean();
    return doc ? String((doc as { _id: unknown })._id) : null;
  }

  async save(customer: Customer): Promise<void> {
    const s = customer.snapshot();
    await CustomerModel.updateOne(
      { _id: customer.id },
      {
        $set: {
          name: s.name,
          // schema lowercases email on save; updateOne skips setters, so do it here
          email: s.email ? String(s.email).toLowerCase() : s.email,
          address: s.address,
          phone: s.phone,
          image: s.image,
        },
      }
    );
  }

  async setShippingAddress(
    id: string,
    address: Record<string, unknown>
  ): Promise<{ matched: boolean }> {
    const update: Record<string, unknown> = { shippingAddress: address };
    if (address.contact) update.phone = address.contact;
    const result = await CustomerModel.updateOne(
      { _id: id },
      { $set: update },
      { upsert: true }
    );
    return { matched: result.matchedCount > 0 || result.upsertedCount > 0 };
  }
}
