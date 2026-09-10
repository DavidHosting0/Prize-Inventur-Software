import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  bottlesToMl,
  mlToBottles,
  productSaleQtyToStockUnits,
  recipeLineCost,
  recipeQtyToStockUnits,
} from "./liquid-stock";
import { productSchema } from "@prize/validators";

const gin = {
  trackLiquid: true,
  bottleContentMl: new Prisma.Decimal(700),
  purchasePrice: new Prisma.Decimal(35),
};

const snack = {
  trackLiquid: false,
  bottleContentMl: null,
  purchasePrice: new Prisma.Decimal(2.5),
};

describe("liquid-stock", () => {
  it("converts bottles to ml for liquid products", () => {
    expect(Number(bottlesToMl(gin, 2))).toBe(1400);
    expect(Number(bottlesToMl(snack, 2))).toBe(2);
  });

  it("displays bottles from ml", () => {
    expect(mlToBottles(gin, 350)).toBe(0.5);
    expect(mlToBottles(snack, 350)).toBeNull();
  });

  it("converts recipe pours to stock ml", () => {
    expect(Number(recipeQtyToStockUnits(gin, 50, "ML"))).toBe(50);
    expect(Number(recipeQtyToStockUnits(gin, 0.05, "LITER"))).toBe(50);
    expect(Number(recipeQtyToStockUnits(gin, 1, "BOTTLE"))).toBe(700);
    expect(Number(recipeQtyToStockUnits(snack, 3, "PIECE"))).toBe(3);
  });

  it("sells whole bottles as bottleContentMl", () => {
    expect(Number(productSaleQtyToStockUnits(gin, 1))).toBe(700);
    expect(Number(productSaleQtyToStockUnits(snack, 1))).toBe(1);
  });

  it("costs recipe lines from bottle purchase price", () => {
    // 50 ml of 700 ml bottle at 35 → 35 * 50/700
    expect(recipeLineCost(gin, 50, "ML")).toBeCloseTo(2.5, 5);
    expect(recipeLineCost(snack, 2, "PIECE")).toBeCloseTo(5, 5);
  });
});

describe("productSchema liquid refine", () => {
  const base = {
    name: "Gin",
    sku: "GIN-1",
    categoryId: "clxxxxxxxx0000000000000001",
    unit: "BOTTLE" as const,
    purchasePrice: 35,
    salePrice: 0,
    vatRate: 8.1,
  };

  it("requires bottleContentMl when trackLiquid", () => {
    const bad = productSchema.safeParse({ ...base, trackLiquid: true });
    expect(bad.success).toBe(false);

    const good = productSchema.safeParse({
      ...base,
      trackLiquid: true,
      bottleContentMl: 700,
    });
    expect(good.success).toBe(true);
  });

  it("allows non-liquid without bottle content", () => {
    const ok = productSchema.safeParse({ ...base, trackLiquid: false });
    expect(ok.success).toBe(true);
  });
});
