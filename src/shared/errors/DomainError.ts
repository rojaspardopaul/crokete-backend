/**
 * Domain error taxonomy.
 *
 * These are language-level, transport-agnostic errors. The presentation layer
 * maps them to HTTP status codes via `toHttpStatus`, so the domain never knows
 * about Express or HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string, public readonly details?: unknown) {
    super(message);
  }
}

/** Spanish labels for entity names used in user-facing not-found messages. */
const ENTITY_ES: Record<string, string> = {
  Product: "Producto",
  Order: "Pedido",
  Customer: "Cliente",
  Category: "Categoría",
  Brand: "Marca",
  Pet: "Mascota",
};

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
  constructor(entity: string, id?: string) {
    const label = ENTITY_ES[entity] ?? entity;
    super(id ? `${label} no encontrado (${id})` : `${label} no encontrado`);
  }
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
}

export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";
}

/** Maps a domain error to an HTTP status code for the presentation layer. */
export function toHttpStatus(error: DomainError): number {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}
