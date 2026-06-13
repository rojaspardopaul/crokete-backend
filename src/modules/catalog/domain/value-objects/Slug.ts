import { ValueObject } from "../../../../shared/kernel/ValueObject";
import { Result } from "../../../../shared/kernel/Result";
import { ValidationError } from "../../../../shared/errors/DomainError";

interface SlugProps {
  value: string;
}

/**
 * URL slug value object. Invariant: non-empty, lowercase, only letters, digits
 * and hyphens. Used by the store to resolve products by URL.
 */
export class Slug extends ValueObject<SlugProps> {
  private constructor(props: SlugProps) {
    super(props);
  }

  static create(raw: string | undefined | null): Result<Slug, ValidationError> {
    if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
      return Result.fail(new ValidationError("slug is required"));
    }
    const normalized = raw.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      return Result.fail(
        new ValidationError(
          "slug must contain only lowercase letters, digits and single hyphens"
        )
      );
    }
    return Result.ok(new Slug({ value: normalized }));
  }

  /**
   * Reconstructs a Slug from already-persisted data WITHOUT re-validating.
   * Legacy slugs may not satisfy the strict format; we trust the database on
   * read and only enforce the invariant on new input (`create`).
   */
  static fromPersistence(value: string): Slug {
    return new Slug({ value: value ?? "" });
  }

  get value(): string {
    return this.props.value;
  }
}
