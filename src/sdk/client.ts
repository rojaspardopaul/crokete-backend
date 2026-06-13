import type { components } from "./generated/types";

/**
 * Minimal typed client over the generated OpenAPI types. This is the hand-thin
 * wrapper that turns `src/sdk/generated/types.ts` into something callable. Any
 * TS consumer (admin, store, scripts) can `createCroketeClient(...)` and get
 * end-to-end typed catalog calls. Python/Angular consumers use the codegen
 * clients described in README.md instead.
 */
type Product = components["schemas"]["Product"];
type CreateProduct = components["schemas"]["CreateProduct"];
type UpdateProduct = components["schemas"]["UpdateProduct"];
type ListProductsResponse = components["schemas"]["ListProductsResponse"];

export interface CroketeClientOptions {
  baseUrl: string;
  /** Bearer token (admin/customer JWT). */
  token?: string;
  /** Override fetch (tests, non-global-fetch runtimes). */
  fetchFn?: typeof fetch;
}

export function createCroketeClient(opts: CroketeClientOptions) {
  const doFetch = opts.fetchFn ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; query?: Record<string, string | number | undefined> }
  ): Promise<T> {
    const url = new URL(opts.baseUrl.replace(/\/$/, "") + path);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await doFetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Crokete API ${method} ${path} -> ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  return {
    catalog: {
      list: (query?: { title?: string; category?: string; price?: string; page?: number; limit?: number }) =>
        request<ListProductsResponse>("GET", "/products", { query }),
      getBySlug: (slug: string) =>
        request<Product>("GET", `/products/product/${encodeURIComponent(slug)}`),
      create: (body: CreateProduct) =>
        request<Product>("POST", "/products/add", { body }),
      update: (id: string, body: UpdateProduct) =>
        request<{ data: Product; message: string }>("PATCH", `/products/${id}`, { body }),
      remove: (id: string) =>
        request<{ message: string }>("DELETE", `/products/${id}`),
    },
  };
}

export type CroketeClient = ReturnType<typeof createCroketeClient>;
