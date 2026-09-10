/** Client-safe liquid stock display helpers (no Prisma). */

export function formatStockQty(opts: {
  quantity: number;
  trackLiquid?: boolean;
  bottleContentMl?: number | string | null;
  bottlesLabel?: string;
}): string {
  const {
    quantity,
    trackLiquid,
    bottleContentMl,
    bottlesLabel = "Fl.",
  } = opts;
  if (!trackLiquid || bottleContentMl == null) {
    return String(Number(quantity.toFixed(3)));
  }
  const content = Number(bottleContentMl);
  if (!(content > 0)) return `${Number(quantity.toFixed(1))} ml`;
  const bottles = quantity / content;
  return `${Number(quantity.toFixed(1))} ml (≈ ${bottles.toFixed(2)} ${bottlesLabel})`;
}

export function mlToBottleInput(
  ml: number,
  bottleContentMl: number | string | null | undefined
): number {
  const content = Number(bottleContentMl ?? 0);
  if (!(content > 0)) return ml;
  return Number((ml / content).toFixed(3));
}
