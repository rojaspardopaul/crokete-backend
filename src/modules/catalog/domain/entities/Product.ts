import { AggregateRoot } from "../../../../shared/kernel/AggregateRoot";
import { Result, combine } from "../../../../shared/kernel/Result";
import { ValidationError } from "../../../../shared/errors/DomainError";
import { MultiLangText } from "../value-objects/MultiLangText";
import { Slug } from "../value-objects/Slug";
import { Price } from "../value-objects/Price";
import { ProductCreated } from "../events/ProductCreated";

export type ProductStatus = "show" | "hide";

/** Reference + marketing fields carried opaquely by the aggregate. */
export interface ProductReferences {
  category?: string;
  categories?: string[];
  pet?: string | null;
  brand?: string | null;
}

interface ProductProps {
  productId?: string;
  sku?: string;
  barcode?: string;
  title: MultiLangText;
  description?: MultiLangText;
  slug: Slug;
  prices: Price;
  stock: number;
  sales: number;
  status: ProductStatus;
  isCombination: boolean;
  image: string[];
  tag: string[];
  variants: Record<string, unknown>[];
  references: ProductReferences;
  /** Extended structured/marketing fields (nutritionTable, visualTags, …). */
  extra: Record<string, unknown>;
}

/** Raw input accepted by the factory (already-parsed contract DTO). */
export interface ProductCreateInput {
  productId?: string;
  sku?: string;
  barcode?: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  slug: string;
  prices: { originalPrice: number; price: number; discount?: number };
  stock?: number;
  isCombination: boolean;
  image?: string[];
  tag?: string[];
  variants?: Record<string, unknown>[];
  references?: ProductReferences;
  extra?: Record<string, unknown>;
}

export class Product extends AggregateRoot<string> {
  private props: ProductProps;

  private constructor(id: string, props: ProductProps) {
    super(id);
    this.props = props;
  }

  // ── Factory: brand-new product (validates + emits ProductCreated) ──
  static create(
    id: string,
    input: ProductCreateInput,
    tenantId?: string
  ): Result<Product, ValidationError> {
    const title = MultiLangText.create(input.title, "title");
    const slug = Slug.create(input.slug);
    const prices = Price.create(input.prices);

    const guard = combine<ValidationError>([title, slug, prices]);
    if (guard.isFail) return Result.fail(guard.getError());

    const stock = input.stock ?? 0;
    if (stock < 0) {
      return Result.fail(new ValidationError("stock cannot be negative"));
    }

    let description: MultiLangText | undefined;
    if (input.description) {
      const d = MultiLangText.create(input.description, "description");
      if (d.isOk) description = d.getValue();
    }

    const product = new Product(id, {
      productId: input.productId,
      sku: input.sku,
      barcode: input.barcode,
      title: title.getValue(),
      description,
      slug: slug.getValue(),
      prices: prices.getValue(),
      stock,
      sales: 0,
      status: "show",
      isCombination: input.isCombination,
      image: input.image ?? [],
      tag: input.tag ?? [],
      variants: input.variants ?? [],
      references: input.references ?? {},
      extra: input.extra ?? {},
    });

    product.addDomainEvent(
      new ProductCreated(id, slug.getValue().value, tenantId)
    );
    return Result.ok(product);
  }

  // ── Rehydration: load an existing product from persistence (no events) ──
  static rehydrate(id: string, props: ProductProps): Product {
    return new Product(id, props);
  }

  // ── Behaviour ──
  changeStatus(status: ProductStatus): void {
    this.props.status = status;
  }

  /**
   * Applies a partial update, mirroring the legacy `updateProduct` merge rules:
   * multi-language fields (title/description and the rich-content fields) are
   * MERGED with the existing value; everything else is replaced. Only keys
   * present in the input are touched.
   */
  applyUpdate(dto: Record<string, unknown>): Result<void, ValidationError> {
    if (dto.title !== undefined) {
      const merged = { ...this.props.title.toObject(), ...(dto.title as object) };
      const title = MultiLangText.create(merged, "title");
      if (title.isFail) return Result.fail(title.getError());
      this.props.title = title.getValue();
    }

    if (dto.description !== undefined) {
      const base = this.props.description?.toObject() ?? {};
      const merged = { ...base, ...(dto.description as object) };
      const description = MultiLangText.create(merged, "description");
      if (description.isOk) this.props.description = description.getValue();
    }

    if (dto.slug !== undefined) {
      const slug = Slug.create(dto.slug as string);
      if (slug.isFail) return Result.fail(slug.getError());
      this.props.slug = slug.getValue();
    }

    if (dto.prices !== undefined) {
      const prices = Price.create(
        dto.prices as { originalPrice: number; price: number; discount?: number }
      );
      if (prices.isFail) return Result.fail(prices.getError());
      this.props.prices = prices.getValue();
    }

    if (dto.stock !== undefined) {
      const stock = Number(dto.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        return Result.fail(new ValidationError("stock cannot be negative"));
      }
      this.props.stock = stock;
    }

    const scalarSetters: Record<string, (v: unknown) => void> = {
      productId: (v) => (this.props.productId = v as string),
      sku: (v) => (this.props.sku = v as string),
      barcode: (v) => (this.props.barcode = v as string),
      isCombination: (v) => (this.props.isCombination = Boolean(v)),
      variants: (v) => (this.props.variants = (v as Record<string, unknown>[]) ?? []),
      image: (v) => (this.props.image = (v as string[]) ?? []),
      tag: (v) => (this.props.tag = (v as string[]) ?? []),
    };
    for (const [key, set] of Object.entries(scalarSetters)) {
      if (dto[key] !== undefined) set(dto[key]);
    }

    // References (pet/brand fall back to null, like legacy).
    if (dto.categories !== undefined) this.props.references.categories = dto.categories as string[];
    if (dto.category !== undefined) this.props.references.category = dto.category as string;
    if (dto.pet !== undefined) this.props.references.pet = (dto.pet as string) || null;
    if (dto.brand !== undefined) this.props.references.brand = (dto.brand as string) || null;

    // Rich-content multi-language fields are merged; other extras are replaced.
    const MERGE_FIELDS = new Set([
      "benefits", "features", "ingredients", "feedingGuide", "indications",
      "warnings", "dosage", "recommendedFor", "brandInfo",
    ]);
    const REFERENCE_OR_CORE = new Set([
      "title", "description", "slug", "prices", "stock", "productId", "sku",
      "barcode", "isCombination", "variants", "image", "tag", "categories",
      "category", "pet", "brand", "_id", "ids",
    ]);
    for (const [key, value] of Object.entries(dto)) {
      if (REFERENCE_OR_CORE.has(key)) continue;
      if (value === undefined) continue;
      if (MERGE_FIELDS.has(key)) {
        const base = (this.props.extra[key] as object) ?? {};
        this.props.extra[key] = { ...base, ...(value as object) };
      } else {
        this.props.extra[key] = value;
      }
    }

    return Result.ok(undefined);
  }

  /** Decrements stock, clamped at 0 (mirrors legacy stock-controller). */
  decreaseStock(quantity: number): void {
    this.props.stock = Math.max(0, this.props.stock - quantity);
    this.props.sales += quantity;
  }

  // ── Accessors for the mapper / read side ──
  get props_(): Readonly<ProductProps> {
    return this.props;
  }
}

export type { ProductProps };
