import { AggregateRoot } from "../../../../shared/kernel/AggregateRoot";

export interface CustomerProfile {
  name?: string;
  email?: string;
  address?: string;
  phone?: string;
  image?: string;
}

interface CustomerProps {
  snapshot: Record<string, unknown>;
}

/**
 * Customer aggregate — scoped to PROFILE and shipping address only. The
 * authentication concerns (password, login, OAuth, verification, tokens) stay
 * in the legacy controller and are NOT modelled here.
 */
export class Customer extends AggregateRoot<string> {
  private props: CustomerProps;

  private constructor(id: string, props: CustomerProps) {
    super(id);
    this.props = props;
  }

  static fromDocument(doc: Record<string, unknown>): Customer {
    return new Customer(String(doc._id), { snapshot: doc });
  }

  get email(): string | undefined {
    return this.props.snapshot.email as string | undefined;
  }

  /** Applies a profile update (mirrors legacy updateCustomer field assignment). */
  updateProfile(fields: CustomerProfile): void {
    const s = this.props.snapshot;
    s.name = fields.name;
    s.email = fields.email;
    s.address = fields.address;
    s.phone = fields.phone;
    s.image = fields.image;
  }

  /** Raw document with current values, used by the token port and responses. */
  snapshot(): Record<string, unknown> {
    return this.props.snapshot;
  }
}

export type { CustomerProps };
