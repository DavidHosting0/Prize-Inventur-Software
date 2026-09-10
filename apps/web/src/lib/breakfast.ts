import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAuditLog } from "./audit";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { subDays } from "date-fns";

/** Parse YYYY-MM-DD as a calendar date (UTC noon) to avoid TZ day shifts on @db.Date. */
export function parseCalendarDate(yyyyMmDd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) throw new Error("INVALID_DATE");
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  );
}

export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export async function upsertBreakfastRecord(
  user: SessionUser,
  input: {
    date: string; // YYYY-MM-DD
    expectedGuests: number;
    actualGuests: number;
    costTotal?: number;
    notes?: string | null;
  }
) {
  assertSessionHotelId(user);
  const date = parseCalendarDate(input.date);
  const record = await prisma.breakfastRecord.upsert({
    where: {
      hotelId_date: { hotelId: user.hotelId, date },
    },
    create: {
      hotelId: user.hotelId,
      date,
      expectedGuests: input.expectedGuests,
      actualGuests: input.actualGuests,
      costTotal: new Prisma.Decimal(input.costTotal ?? 0),
      notes: input.notes ?? null,
    },
    update: {
      expectedGuests: input.expectedGuests,
      actualGuests: input.actualGuests,
      costTotal: new Prisma.Decimal(input.costTotal ?? 0),
      notes: input.notes ?? null,
    },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "breakfast.upsert",
    entity: "BreakfastRecord",
    entityId: record.id,
    newValue: {
      date: input.date,
      expected: input.expectedGuests,
      actual: input.actualGuests,
    },
  });

  return record;
}

/** Simple forecast: avg actual guests last N days * per-guest product ratios from seed heuristics. */
export async function getBreakfastForecast(user: SessionUser, days = 14) {
  assertSessionHotelId(user);
  const from = subDays(new Date(), days);
  const records = await prisma.breakfastRecord.findMany({
    where: { hotelId: user.hotelId, date: { gte: from } },
    orderBy: { date: "desc" },
  });

  const avgGuests =
    records.length > 0
      ? records.reduce((s, r) => s + r.actualGuests, 0) / records.length
      : 100;

  const expectedTomorrow = Math.round(avgGuests * 1.05);

  // Heuristic per-guest consumption (demo-grade until linked to recipes)
  const perGuest = [
    { key: "eggs", skuHint: "BF-EGGS", perGuest: 1.05, unit: "PIECE" },
    { key: "breadrolls", skuHint: "BF-BREADROLL", perGuest: 1.45, unit: "PIECE" },
    { key: "milk", skuHint: "BF-MILK", perGuest: 0.23, unit: "LITER" },
    { key: "coffee", skuHint: "BF-COFFEE", perGuest: 0.045, unit: "KG" },
    { key: "croissant", skuHint: "BF-CROISSANT", perGuest: 0.55, unit: "PIECE" },
  ];

  const products = await prisma.product.findMany({
    where: {
      hotelId: user.hotelId,
      sku: { in: perGuest.map((p) => p.skuHint) },
    },
  });
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const requirements = perGuest.map((p) => {
    const product = bySku.get(p.skuHint);
    const qty = Math.ceil(expectedTomorrow * p.perGuest);
    return {
      key: p.key,
      sku: p.skuHint,
      productId: product?.id ?? null,
      name: product?.name ?? p.key,
      quantity: qty,
      unit: p.unit,
      cost: product ? qty * Number(product.purchasePrice) : 0,
    };
  });

  const costPerBreakfast =
    records.length > 0
      ? records.reduce((s, r) => s + Number(r.costTotal), 0) /
        Math.max(
          1,
          records.reduce((s, r) => s + r.actualGuests, 0)
        )
      : requirements.reduce((s, r) => s + r.cost, 0) / Math.max(1, expectedTomorrow);

  return {
    avgGuests: Math.round(avgGuests),
    expectedTomorrow,
    costPerBreakfast,
    requirements,
    recent: records.slice(0, 7),
  };
}
