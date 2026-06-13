import { ValueObject } from "../../../../shared/kernel/ValueObject";
import { Result } from "../../../../shared/kernel/Result";
import { ValidationError } from "../../../../shared/errors/DomainError";

interface PriceProps {
  originalPrice: number;
  price: number;
  discount: number;
}

/**
 * Pricing value object (mirrors Product.prices). Invariants:
 *  - originalPrice and price are non-negative finite numbers
 *  - the sale price never exceeds the original price
 *  - discount is derived and consistent (originalPrice - price)
 */
export class Price extends ValueObject<PriceProps> {
  private constructor(props: PriceProps) {
    super(props);
  }

  static create(raw: {
    originalPrice: number;
    price: number;
    discount?: number;
  }): Result<Price, ValidationError> {
    const { originalPrice, price } = raw;

    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      return Result.fail(
        new ValidationError("originalPrice must be a non-negative number")
      );
    }
    if (!Number.isFinite(price) || price < 0) {
      return Result.fail(
        new ValidationError("price must be a non-negative number")
      );
    }
    if (price > originalPrice) {
      return Result.fail(
        new ValidationError("price cannot be greater than originalPrice")
      );
    }

    const discount = Math.round((originalPrice - price) * 100) / 100;
    return Result.ok(new Price({ originalPrice, price, discount }));
  }

  /** Reconstructs from persisted data without re-validating (trusts the DB). */
  static fromPersistence(raw: {
    originalPrice?: number;
    price?: number;
    discount?: number;
  }): Price {
    return new Price({
      originalPrice: raw.originalPrice ?? 0,
      price: raw.price ?? 0,
      discount: raw.discount ?? 0,
    });
  }

  get originalPrice(): number {
    return this.props.originalPrice;
  }
  get price(): number {
    return this.props.price;
  }
  get discount(): number {
    return this.props.discount;
  }

  toObject(): PriceProps {
    return { ...this.props };
  }
}
