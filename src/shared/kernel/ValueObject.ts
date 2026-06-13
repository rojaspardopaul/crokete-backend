/**
 * Base class for Value Objects.
 *
 * Value Objects are immutable and compared by structural equality, not identity.
 * Construct them through a static factory that returns a Result so invariants
 * are enforced at the boundary (see Money, Slug, MultiLangText).
 */
export abstract class ValueObject<T extends object> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(other?: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    if (other.props === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
