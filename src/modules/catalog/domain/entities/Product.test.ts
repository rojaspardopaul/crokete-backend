import { describe, it, expect } from "vitest";
import { Product } from "./Product";
import { PRODUCT_CREATED } from "../events/ProductCreated";

const validInput = {
  title: { es: "Pienso", en: "Dog food" },
  slug: "royal-canin",
  prices: { originalPrice: 100, price: 90 },
  isCombination: false,
};

describe("Product.create", () => {
  it("creates a product and records a ProductCreated event", () => {
    const r = Product.create("id1", validInput);
    expect(r.isOk).toBe(true);
    const events = r.getValue().pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe(PRODUCT_CREATED);
  });

  it("fails when the title is empty", () => {
    const r = Product.create("id1", { ...validInput, title: {} });
    expect(r.isFail).toBe(true);
  });

  it("fails when the price is invalid", () => {
    const r = Product.create("id1", {
      ...validInput,
      prices: { originalPrice: 10, price: 50 },
    });
    expect(r.isFail).toBe(true);
  });

  it("keeps extended fields in the extra bag", () => {
    const r = Product.create("id1", {
      ...validInput,
      extra: { visualTags: ["new"] },
    } as never);
    expect(r.getValue().props_.extra.visualTags).toEqual(["new"]);
  });
});

describe("Product.applyUpdate", () => {
  it("merges multi-language title rather than replacing it", () => {
    const product = Product.create("id1", validInput).getValue();
    product.applyUpdate({ title: { en: "Premium dog food" } });
    expect(product.props_.title.toObject()).toEqual({
      es: "Pienso",
      en: "Premium dog food",
    });
  });

  it("merges rich-content fields but replaces plain extras", () => {
    const product = Product.create("id1", {
      ...validInput,
      extra: { benefits: { es: "Sano" }, visualTags: ["new"] },
    } as never).getValue();

    product.applyUpdate({
      benefits: { en: "Healthy" },
      visualTags: ["sale"],
    });

    expect(product.props_.extra.benefits).toEqual({ es: "Sano", en: "Healthy" });
    expect(product.props_.extra.visualTags).toEqual(["sale"]);
  });

  it("normalises pet/brand empty values to null", () => {
    const product = Product.create("id1", validInput).getValue();
    product.applyUpdate({ pet: "", brand: "" });
    expect(product.props_.references.pet).toBeNull();
    expect(product.props_.references.brand).toBeNull();
  });
});
