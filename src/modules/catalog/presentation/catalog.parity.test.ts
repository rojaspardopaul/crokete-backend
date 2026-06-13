import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { buildCatalogModule } from "../CatalogModule";
import { InMemoryProductRepository } from "../infrastructure/testing/InMemoryProductRepository";
import { EventBus } from "../../../shared/events/EventBus";
import type { CatalogCachePort, CatalogReadPort } from "../application/ports";

function fakeCache(): CatalogCachePort {
  return {
    invalidateProducts: vi.fn(),
    invalidateProductBySlug: vi.fn(),
    invalidateAll: vi.fn(),
  };
}

function fakeRead(): CatalogReadPort {
  return {
    getProductBySlugCached: vi.fn(async (slug: string) => ({
      data: { slug, title: { es: "Pienso" } },
      fromCache: false,
      ttl: 300,
    })),
    listProductsAdmin: vi.fn(async () => ({
      products: [{ _id: "p1" }],
      totalDoc: 1,
      limits: 10,
      pages: 1,
    })),
    getShowingProducts: vi.fn(async () => [{ _id: "p1" }]),
    getProductById: vi.fn(async (id: string) => ({ _id: id })),
    getStoreProducts: vi.fn(async (_params, isAdmin: boolean) => ({
      data: { products: [{ _id: "p1" }], popularProducts: [], discountedProducts: [], relatedProducts: [], reviews: [] },
      fromCache: false,
      ttl: 60,
      bypass: isAdmin,
    })),
  };
}

const validBody = {
  title: { es: "Pienso" },
  slug: "royal-canin",
  category: "665f1b2c3d4e5f6a7b8c9d0e",
  prices: { originalPrice: 100, price: 90 },
  isCombination: false,
  visualTags: ["new"],
};

describe("catalog router (HTTP parity)", () => {
  let app: Express;
  let repo: InMemoryProductRepository;

  beforeEach(() => {
    repo = new InMemoryProductRepository();
    const { router } = buildCatalogModule({
      products: repo,
      cache: fakeCache(),
      read: fakeRead(),
      events: new EventBus(),
    });
    app = express();
    app.use(express.json());
    app.use("/products", router);
  });

  it("POST /products/add creates and returns the product (legacy shape)", async () => {
    const res = await request(app).post("/products/add").send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("royal-canin");
    expect(res.body.title).toEqual({ es: "Pienso" });
    expect(res.body.visualTags).toEqual(["new"]); // passthrough preserved
    expect(res.body._id).toBeDefined();
  });

  it("POST /products/add returns 400 on invalid price", async () => {
    const res = await request(app)
      .post("/products/add")
      .send({ ...validBody, prices: { originalPrice: 10, price: 99 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("PATCH /products/:id returns { data, message }", async () => {
    const created = await request(app).post("/products/add").send(validBody);
    const id = created.body._id;
    const res = await request(app)
      .patch(`/products/${id}`)
      .send({ title: { en: "Premium" } });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product updated successfully!");
    expect(res.body.data.title).toEqual({ es: "Pienso", en: "Premium" });
  });

  it("PUT /products/status/:id toggles status", async () => {
    const created = await request(app).post("/products/add").send(validBody);
    const res = await request(app)
      .put(`/products/status/${created.body._id}`)
      .send({ status: "hide" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product hide Successfully!");
  });

  it("DELETE /products/:id removes the product", async () => {
    const created = await request(app).post("/products/add").send(validBody);
    const res = await request(app).delete(`/products/${created.body._id}`);
    expect(res.status).toBe(200);
    expect(repo.count()).toBe(0);
  });

  it("GET /products/product/:slug returns data with cache headers", async () => {
    const res = await request(app).get("/products/product/royal-canin");
    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.slug).toBe("royal-canin");
  });

  it("GET /products returns the paginated admin shape", async () => {
    const res = await request(app).get("/products?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalDoc: 1, pages: 1, limits: 10 });
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it("GET /products/store returns the storefront bundle with MISS cache header", async () => {
    const res = await request(app).get("/products/store");
    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body).toHaveProperty("popularProducts");
    expect(res.body).toHaveProperty("discountedProducts");
  });

  it("GET /products/store rejects an over-long title", async () => {
    const res = await request(app).get(`/products/store?title=${"a".repeat(101)}`);
    expect(res.status).toBe(400);
  });

  it("PATCH /products/update/many updates the given ids", async () => {
    const a = await request(app).post("/products/add").send(validBody);
    const b = await request(app)
      .post("/products/add")
      .send({ ...validBody, slug: "another" });
    const res = await request(app)
      .patch("/products/update/many")
      .send({ ids: [a.body._id, b.body._id], tag: ["promo"] });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Products update successfully!");
  });

  it("POST /products/all bulk-replaces the catalog", async () => {
    await request(app).post("/products/add").send(validBody);
    const res = await request(app)
      .post("/products/all")
      .send([{ _id: "x1", slug: "bulk", title: { es: "B" }, prices: { originalPrice: 1, price: 1 }, isCombination: false }]);
    expect(res.status).toBe(200);
    expect(repo.count()).toBe(1);
  });
});
