import { describe, expect, it } from "vitest";
import { matchProductLine } from "./delivery-note-match";

const catalog = [
  {
    id: "p1",
    name: "Coca-Cola Zero 0.5L",
    sku: "CCZ-05",
    ean: "5449000131805",
    barcode: "5449000131805",
    purchasePrice: { toString: () => "1.20" },
    unit: "PIECE",
    supplierId: "s1",
    supplierSkus: ["SUP-CCZ"],
  },
  {
    id: "p2",
    name: "Water 0.5L",
    sku: "WAT-05",
    ean: null,
    barcode: null,
    purchasePrice: { toString: () => "0.50" },
    unit: "PIECE",
    supplierId: "s1",
    supplierSkus: [],
  },
];

describe("matchProductLine", () => {
  it("matches exact EAN first", () => {
    const result = matchProductLine(
      {
        productName: "Something else",
        ean: "5449000131805",
        quantity: 24,
      },
      catalog,
      "s1"
    );
    expect(result.productId).toBe("p1");
    expect(result.matchMethod).toBe("ean");
    expect(result.matchStatus).toBe("matched");
  });

  it("matches supplier SKU", () => {
    const result = matchProductLine(
      {
        productName: "Cola Zero",
        productNumber: "SUP-CCZ",
        quantity: 12,
      },
      catalog,
      "s1"
    );
    expect(result.productId).toBe("p1");
    expect(result.matchMethod).toBe("supplier_sku");
  });

  it("fuzzy-matches high confidence names", () => {
    const result = matchProductLine(
      {
        productName: "Coca Cola Zero 0,5L",
        quantity: 24,
      },
      catalog,
      "s1"
    );
    expect(result.productId).toBe("p1");
    expect(["name_high", "name_fuzzy"]).toContain(result.matchMethod);
  });

  it("returns unmatched when nothing fits", () => {
    const result = matchProductLine(
      {
        productName: "Completely Unknown Widget XYZ",
        quantity: 1,
      },
      catalog,
      "s1"
    );
    expect(result.matchStatus).toBe("unmatched");
    expect(result.productId).toBeNull();
  });
});
