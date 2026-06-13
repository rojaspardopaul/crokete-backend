/** Read model for customer queries. */
export interface CustomerReadPort {
  listCustomers(): Promise<unknown>;
  getById(id: string): Promise<unknown>;
  getShippingAddress(id: string): Promise<unknown>;
}

/**
 * Issues JWTs. Implemented by the legacy config/auth (generateAccessToken /
 * generateRefreshToken) and injected, so token signing stays in one battle-
 * tested place and the TS module never re-implements it.
 */
export interface CustomerTokenPort {
  generateAccessToken(user: Record<string, unknown>): string;
  generateRefreshToken(user: Record<string, unknown>): string;
}
