import { Prisma, type MovementType } from "@prisma/client";
import { prisma } from "./db";

/**
 * Atomically apply a stock delta with row lock (FOR UPDATE).
 * Prevents lost updates under concurrent POS / receiving / transfers.
 */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: {
    hotelId: string;
    productId: string;
    warehouseId: string;
    userId?: string | null;
    delta: Prisma.Decimal | number | string;
    type: MovementType;
    reason?: string;
    referenceType?: string;
    referenceId?: string;
  }
) {
  const delta = new Prisma.Decimal(input.delta);

  const locked = await tx.$queryRaw<Array<{ id: string; quantity: Prisma.Decimal }>>`
    SELECT id, quantity FROM "StockLevel"
    WHERE "productId" = ${input.productId}
      AND "warehouseId" = ${input.warehouseId}
    FOR UPDATE
  `;

  let before = new Prisma.Decimal(0);

  if (locked[0]) {
    before = new Prisma.Decimal(locked[0].quantity.toString());
  }

  const after = before.add(delta);
  if (after.lt(0)) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  let stock;
  if (locked[0]) {
    stock = await tx.stockLevel.update({
      where: { id: locked[0].id },
      data: { quantity: after, lastMovementAt: new Date() },
    });
  } else {
    try {
      stock = await tx.stockLevel.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: after,
          lastMovementAt: new Date(),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const again = await tx.$queryRaw<
          Array<{ id: string; quantity: Prisma.Decimal }>
        >`
          SELECT id, quantity FROM "StockLevel"
          WHERE "productId" = ${input.productId}
            AND "warehouseId" = ${input.warehouseId}
          FOR UPDATE
        `;
        if (!again[0]) throw e;
        before = new Prisma.Decimal(again[0].quantity.toString());
        const retryAfter = before.add(delta);
        if (retryAfter.lt(0)) throw new Error("INSUFFICIENT_STOCK");
        stock = await tx.stockLevel.update({
          where: { id: again[0].id },
          data: { quantity: retryAfter, lastMovementAt: new Date() },
        });
        await tx.inventoryMovement.create({
          data: {
            hotelId: input.hotelId,
            productId: input.productId,
            warehouseId: input.warehouseId,
            userId: input.userId ?? null,
            type: input.type,
            quantity: delta,
            quantityBefore: before,
            quantityAfter: retryAfter,
            reason: input.reason,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
          },
        });
        return stock;
      }
      throw e;
    }
  }

  await tx.inventoryMovement.create({
    data: {
      hotelId: input.hotelId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      userId: input.userId ?? null,
      type: input.type,
      quantity: delta,
      quantityBefore: before,
      quantityAfter: after,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });

  return stock;
}

export async function getStockQty(
  productId: string,
  warehouseId: string
): Promise<Prisma.Decimal> {
  const row = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return row?.quantity ?? new Prisma.Decimal(0);
}
