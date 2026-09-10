import { Prisma, type Unit } from "@prisma/client";

export type LiquidProductFields = {
  trackLiquid: boolean;
  bottleContentMl: Prisma.Decimal | number | string | null;
  purchasePrice?: Prisma.Decimal | number | string | null;
};

function d(n: number | string | Prisma.Decimal) {
  return n instanceof Prisma.Decimal ? n : new Prisma.Decimal(n);
}

export function bottleContent(product: LiquidProductFields): Prisma.Decimal | null {
  if (!product.trackLiquid || product.bottleContentMl == null) return null;
  const content = d(product.bottleContentMl);
  if (content.lte(0)) return null;
  return content;
}

/** Convert bottle count → stock ml when product tracks liquid. */
export function bottlesToMl(
  product: LiquidProductFields,
  bottles: number | string | Prisma.Decimal
): Prisma.Decimal {
  const content = bottleContent(product);
  if (!content) return d(bottles);
  return d(bottles).mul(content);
}

/** Display helper: stock ml → approximate bottles. */
export function mlToBottles(
  product: LiquidProductFields,
  ml: number | string | Prisma.Decimal
): number | null {
  const content = bottleContent(product);
  if (!content) return null;
  return Number(d(ml).div(content).toFixed(3));
}

/**
 * Recipe / pour quantity → stock delta in ml for liquid products.
 * Non-liquid products: returns qty unchanged (unit is ignored for stock math).
 */
export function recipeQtyToStockUnits(
  product: LiquidProductFields,
  qty: number | string | Prisma.Decimal,
  unit: Unit
): Prisma.Decimal {
  const amount = d(qty);
  if (!product.trackLiquid) return amount;

  const content = bottleContent(product);
  switch (unit) {
    case "ML":
      return amount;
    case "LITER":
      return amount.mul(1000);
    case "BOTTLE":
      return content ? amount.mul(content) : amount;
    default:
      // G/KG/PIECE/etc. on a liquid product: treat as ml for safety only if ML-like;
      // otherwise assume already stock units (ml).
      return amount;
  }
}

/** Purchase cost for a recipe line when purchasePrice is per bottle. */
export function recipeLineCost(
  product: LiquidProductFields,
  qty: number | string | Prisma.Decimal,
  unit: Unit
): number {
  const stockQty = recipeQtyToStockUnits(product, qty, unit);
  const price = Number(product.purchasePrice ?? 0);
  if (!product.trackLiquid) {
    return Number(stockQty) * price;
  }
  const content = bottleContent(product);
  if (!content || content.lte(0)) return Number(stockQty) * price;
  return Number(stockQty.div(content).mul(price));
}

/** PRODUCT POS sale quantity (bottles sold) → stock delta magnitude in ml. */
export function productSaleQtyToStockUnits(
  product: LiquidProductFields,
  saleQty: number | string | Prisma.Decimal
): Prisma.Decimal {
  return bottlesToMl(product, saleQty);
}
