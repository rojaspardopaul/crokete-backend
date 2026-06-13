import mongoose, { Schema } from "mongoose";
import type { InventoryPort } from "../application/InventoryPort";
import type { OrderLineItem } from "../../orders/domain/events/OrderPaid";

/**
 * Mongoose implementation of InventoryPort. TypeScript port of
 * lib/stock-controller/others.js (handleProductQuantity): uses an aggregation
 * pipeline update to clamp stock/quantity at 0, preventing negative values
 * under concurrent orders.
 *
 * Uses a non-strict model reference to the existing `products` collection so it
 * stays decoupled from the catalog module's schema.
 */
function productModel(): mongoose.Model<Record<string, unknown>> {
  return (
    (mongoose.models.Product as mongoose.Model<Record<string, unknown>>) ??
    mongoose.model("Product", new Schema({}, { strict: false }))
  );
}

export class MongoInventoryAdapter implements InventoryPort {
  async decrementForOrder(items: OrderLineItem[]): Promise<void> {
    if (!items?.length) return;
    const Product = productModel();

    await Promise.all(
      items.map((p) => {
        if (p.isCombination) {
          return Product.findOneAndUpdate(
            { _id: p._id, "variants.productId": p.variant?.productId ?? "" },
            [
              {
                $set: {
                  stock: { $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, p.quantity] }] },
                  sales: { $add: [{ $ifNull: ["$sales", 0] }, p.quantity] },
                  variants: {
                    $map: {
                      input: "$variants",
                      as: "v",
                      in: {
                        $cond: [
                          { $eq: ["$$v.productId", p.variant?.productId ?? ""] },
                          {
                            $mergeObjects: [
                              "$$v",
                              {
                                quantity: {
                                  $max: [0, { $subtract: [{ $ifNull: ["$$v.quantity", 0] }, p.quantity] }],
                                },
                              },
                            ],
                          },
                          "$$v",
                        ],
                      },
                    },
                  },
                },
              },
            ]
          );
        }
        return Product.findOneAndUpdate({ _id: p._id }, [
          {
            $set: {
              stock: { $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, p.quantity] }] },
              sales: { $add: [{ $ifNull: ["$sales", 0] }, p.quantity] },
            },
          },
        ]);
      })
    );
  }
}
