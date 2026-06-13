import { describe, it, expect } from "vitest";
import { Price } from "./Price";
import { Slug } from "./Slug";
import { MultiLangText } from "./MultiLangText";

describe("Price", () => {
  it("derives discount and accepts a valid price", () => {
    const r = Price.create({ originalPrice: 100, price: 80 });
    expect(r.isOk).toBe(true);
    expect(r.getValue().discount).toBe(20);
  });

  it("rejects a sale price greater than the original", () => {
    const r = Price.create({ originalPrice: 50, price: 80 });
    expect(r.isFail).toBe(true);
    expect(r.getError().message).toMatch(/cannot be greater/);
  });

  it("rejects negative prices", () => {
    expect(Price.create({ originalPrice: -1, price: 0 }).isFail).toBe(true);
  });
});

describe("Slug", () => {
  it("normalises to lowercase", () => {
    const r = Slug.create("Royal-Canin");
    expect(r.isOk).toBe(true);
    expect(r.getValue().value).toBe("royal-canin");
  });

  it("rejects spaces and empty values", () => {
    expect(Slug.create("dog food").isFail).toBe(true);
    expect(Slug.create("").isFail).toBe(true);
  });

  it("fromPersistence trusts legacy data without validating", () => {
    expect(Slug.fromPersistence("Legacy Slug!").value).toBe("Legacy Slug!");
  });
});

describe("MultiLangText", () => {
  it("requires at least one non-empty locale", () => {
    expect(MultiLangText.create({}).isFail).toBe(true);
    expect(MultiLangText.create({ es: "  " }).isFail).toBe(true);
    expect(MultiLangText.create({ es: "Pienso" }).isOk).toBe(true);
  });

  it("strips empty locales", () => {
    const r = MultiLangText.create({ es: "Pienso", en: "" });
    expect(r.getValue().toObject()).toEqual({ es: "Pienso" });
  });
});
