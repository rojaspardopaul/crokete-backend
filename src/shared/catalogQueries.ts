/**
 * Consultas del catálogo sobre Postgres, compartidas con los controladores JS.
 *
 * Igual que con los presentadores: hay dos entradas al mismo catálogo (los
 * manejadores heredados y este módulo DDD), y una segunda implementación de las
 * mismas consultas acabaría devolviendo formas distintas según quién conteste.
 * El `require` es en tiempo de ejecución porque el módulo es CommonJS y vive
 * fuera de `src/`.
 */

type Row = Record<string, unknown>;

export interface AdminListQuery {
  title?: string;
  category?: string;
  price?: string;
  page?: number;
  limit?: number;
}

export interface StoreQueryParams {
  category?: string;
  title?: string;
  slug?: string;
  pet?: string;
  brand?: string;
}

interface CatalogQueries {
  findProductById(id: string): Promise<Row | null>;
  findProductBySlug(slug: string): Promise<Row | null>;
  findShowingProducts(): Promise<Row[]>;
  listProductsAdmin(query: AdminListQuery): Promise<{
    products: Row[];
    totalDoc: number;
    limits?: number;
    pages?: number;
  }>;
  executeStoreQuery(params: StoreQueryParams): Promise<Row>;
  saveProductDoc(doc: Row): Promise<Row | null>;
  replaceAllProducts(docs: Row[]): Promise<void>;
  updateManyProducts(ids: string[], body: Row): Promise<void>;
  deleteProductById(id: string): Promise<boolean>;
  deleteProducts(ids: string[]): Promise<void>;
}

export function catalog(): CatalogQueries {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("../../lib/prisma/catalog") as CatalogQueries;
}
