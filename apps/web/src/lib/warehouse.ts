import type { Prisma, Warehouse } from "@prisma/client";
import { prisma } from "./db";

/** Single central inventory code for every hotel. */
export const CENTRAL_WAREHOUSE_CODE = "LAGER";
export const CENTRAL_WAREHOUSE_NAME = "Lager";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Resolve the hotel's single active central warehouse ("Lager").
 * Prefer code LAGER; fall back to any remaining active warehouse (pre-migration).
 */
export async function getCentralWarehouse(
  hotelId: string,
  db: Db = prisma
): Promise<Warehouse> {
  const lager = await db.warehouse.findFirst({
    where: { hotelId, code: CENTRAL_WAREHOUSE_CODE, isActive: true },
  });
  if (lager) return lager;

  const active = await db.warehouse.findFirst({
    where: { hotelId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (active) return active;

  throw new Error("WAREHOUSE_NOT_FOUND");
}

/** Ensure a central Lager warehouse exists (create if missing). */
export async function ensureCentralWarehouse(
  hotelId: string,
  db: Db = prisma
): Promise<Warehouse> {
  try {
    return await getCentralWarehouse(hotelId, db);
  } catch {
    return db.warehouse.create({
      data: {
        hotelId,
        name: CENTRAL_WAREHOUSE_NAME,
        code: CENTRAL_WAREHOUSE_CODE,
        isActive: true,
      },
    });
  }
}

/** Stock quantity for a product in the hotel's central Lager. */
export async function getCentralStockQty(
  hotelId: string,
  productId: string,
  db: Db = prisma
): Promise<Prisma.Decimal> {
  const { Prisma } = await import("@prisma/client");
  const warehouse = await getCentralWarehouse(hotelId, db);
  const row = await db.stockLevel.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId: warehouse.id },
    },
  });
  return row?.quantity ?? new Prisma.Decimal(0);
}
