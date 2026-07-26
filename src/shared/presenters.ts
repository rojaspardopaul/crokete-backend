/**
 * Traducción fila de Postgres → forma heredada de la API.
 *
 * Se reutilizan los presentadores de `lib/prisma/presenters.js` en vez de
 * reimplementarlos en TypeScript: son la única frontera donde vive la
 * compatibilidad con crokete-admin y crokete-store, y tener dos copias es justo
 * la forma en que las respuestas empiezan a divergir según qué módulo conteste.
 */

type Row = Record<string, unknown>;

interface Presenters {
  toApi: (value: unknown) => Row;
  num: (value: unknown, fallback?: number) => number;
  productToApi: (row: Row) => Row;
  orderToApi: (row: Row) => Row;
  orderItemToApi: (row: Row) => Row;
  customerToApi: (row: Row) => Row;
  reviewToApi: (row: Row) => Row;
}

function presenters(): Presenters {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("../../lib/prisma/presenters") as Presenters;
}

export const toApi = (value: unknown): Row => presenters().toApi(value);
export const num = (value: unknown, fallback = 0): number =>
  presenters().num(value, fallback);
export const productToApi = (row: Row): Row => presenters().productToApi(row);
export const orderToApi = (row: Row): Row => presenters().orderToApi(row);
export const customerToApi = (row: Row): Row => presenters().customerToApi(row);
export const reviewToApi = (row: Row): Row => presenters().reviewToApi(row);
