import { describe, it, expect, vi } from "vitest";
import { CreateProduct } from "./use-cases/CreateProduct";
import { UpdateProduct } from "./use-cases/UpdateProduct";
import { InMemoryProductRepository } from "../infrastructure/testing/InMemoryProductRepository";
import { EventBus } from "../../../shared/events/EventBus";
import { PRODUCT_CREATED } from "../domain/events/ProductCreated";
import type { CatalogCachePort } from "./ports";

function fakeCache(): CatalogCachePort {
  return {
    invalidateProducts: vi.fn(),
    invalidateProductBySlug: vi.fn(),
    invalidateAll: vi.fn(),
  };
}

const dto = {
  title: { es: "Pienso" },
  slug: "royal-canin",
  category: "3f1b9f0c-7a1e-4d2b-9f3a-2c8e5d6b7a10",
  prices: { originalPrice: 100, price: 90 },
  isCombination: false,
  visualTags: ["new"],
};

describe("CreateProduct use-case", () => {
  it("persists, invalidates cache and publishes ProductCreated", async () => {
    const repo = new InMemoryProductRepository();
    const cache = fakeCache();
    const bus = new EventBus();
    const onCreated = vi.fn();
    bus.subscribe(PRODUCT_CREATED, onCreated);

    const result = await new CreateProduct(repo, cache, bus).execute({ ...dto });

    expect(result.isOk).toBe(true);
    expect(repo.count()).toBe(1);
    expect(cache.invalidateProducts).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
    // extended field survived into persistence (response parity)
    expect(result.getValue().visualTags).toEqual(["new"]);
  });

  it("returns a validation failure for an invalid price", async () => {
    const repo = new InMemoryProductRepository();
    const result = await new CreateProduct(repo, fakeCache(), new EventBus()).execute({
      ...dto,
      prices: { originalPrice: 10, price: 99 },
    });
    expect(result.isFail).toBe(true);
    expect(repo.count()).toBe(0);
  });
});

describe("UpdateProduct use-case", () => {
  it("invalidates both old and new slug after a slug change", async () => {
    const repo = new InMemoryProductRepository();
    const cache = fakeCache();
    const bus = new EventBus();

    const created = await new CreateProduct(repo, cache, bus).execute({ ...dto });
    const id = String(created.getValue()._id);

    const result = await new UpdateProduct(repo, cache).execute(id, {
      slug: "royal-canin-maxi",
    });

    expect(result.isOk).toBe(true);
    expect(cache.invalidateProductBySlug).toHaveBeenCalledWith("royal-canin");
    expect(cache.invalidateProductBySlug).toHaveBeenCalledWith("royal-canin-maxi");
  });

  it("returns NotFound for an unknown id", async () => {
    const repo = new InMemoryProductRepository();
    const result = await new UpdateProduct(repo, fakeCache()).execute("missing", {
      slug: "x",
    });
    expect(result.isFail).toBe(true);
    expect(result.getError().code).toBe("NOT_FOUND");
  });
});
