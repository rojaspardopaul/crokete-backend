/**
 * Result / Either pattern.
 *
 * Domain and application code returns `Result` instead of throwing, so that
 * expected failures (validation, not-found, conflicts) are part of the type
 * signature and the caller is forced to handle them. Only truly exceptional
 * situations (a bug, infra down) should throw.
 */
export class Result<T, E = Error> {
  private constructor(
    public readonly isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static fail<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  get isFail(): boolean {
    return !this.isOk;
  }

  /** Returns the success value. Throws if called on a failure (programmer error). */
  getValue(): T {
    if (!this.isOk) {
      throw new Error("Called getValue() on a failed Result");
    }
    return this._value as T;
  }

  /** Returns the error. Throws if called on a success (programmer error). */
  getError(): E {
    if (this.isOk) {
      throw new Error("Called getError() on a successful Result");
    }
    return this._error as E;
  }

  /** Maps the success value, leaving failures untouched. */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk
      ? Result.ok<U, E>(fn(this._value as T))
      : Result.fail<U, E>(this._error as E);
  }
}

/** Combines many Results into one; fails with the first error encountered. */
export function combine<E = Error>(
  results: Result<unknown, E>[]
): Result<void, E> {
  for (const r of results) {
    if (r.isFail) return Result.fail<void, E>(r.getError());
  }
  return Result.ok<void, E>(undefined);
}
