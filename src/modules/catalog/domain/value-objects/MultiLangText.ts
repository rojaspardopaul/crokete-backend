import { ValueObject } from "../../../../shared/kernel/ValueObject";
import { Result } from "../../../../shared/kernel/Result";
import { ValidationError } from "../../../../shared/errors/DomainError";

interface MultiLangTextProps {
  values: Record<string, string>;
}

/**
 * Multi-language text value object: { es: "Pienso", en: "Dog food" }.
 *
 * Invariant: at least one locale with non-empty text. This formalises the
 * legacy "plain Object with locale keys" convention into something that can be
 * validated and compared.
 */
export class MultiLangText extends ValueObject<MultiLangTextProps> {
  private constructor(props: MultiLangTextProps) {
    super(props);
  }

  static create(
    raw: Record<string, string> | undefined | null,
    field = "text"
  ): Result<MultiLangText, ValidationError> {
    if (!raw || typeof raw !== "object") {
      return Result.fail(new ValidationError(`${field} is required`));
    }
    const entries = Object.entries(raw).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    if (entries.length === 0) {
      return Result.fail(
        new ValidationError(`${field} must have at least one non-empty locale`)
      );
    }
    return Result.ok(
      new MultiLangText({ values: Object.fromEntries(entries) })
    );
  }

  /** Reconstructs from persisted data without validation (trusts the DB). */
  static fromPersistence(raw: Record<string, string> | undefined | null): MultiLangText {
    return new MultiLangText({ values: raw ?? {} });
  }

  get(locale: string): string | undefined {
    return this.props.values[locale];
  }

  toObject(): Record<string, string> {
    return { ...this.props.values };
  }
}
