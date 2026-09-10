import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { getCentralWarehouse } from "./warehouse";

/**
 * Record minibar consumption for a room.
 * Reduces central Lager stock. Room number is a guest/room reference only —
 * it does not create a separate inventory location or room charge / folio.
 */
export async function recordMinibarConsumption(
  user: SessionUser,
  input: {
    roomNumber: string;
    productId: string;
    quantity: number;
    notes?: string | null;
  }
) {
  assertSessionHotelId(user);
  const product = await prisma.product.findFirst({
    where: { id: input.productId, hotelId: user.hotelId },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const warehouse = await getCentralWarehouse(user.hotelId);

  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) throw new Error("INVALID_QUANTITY");

  return prisma.$transaction(async (tx) => {
    const record = await tx.minibarRecord.create({
      data: {
        hotelId: user.hotelId,
        roomNumber: input.roomNumber,
        productId: product.id,
        quantity: qty,
        recordedById: user.id,
        notes: input.notes ?? null,
      },
    });

    await applyStockChange(tx, {
      hotelId: user.hotelId,
      productId: product.id,
      warehouseId: warehouse.id,
      userId: user.id,
      delta: qty.neg(),
      type: "SALE",
      reason: `Minibar room ${input.roomNumber} (reference only, no folio)`,
      referenceType: "MinibarRecord",
      referenceId: record.id,
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "minibar.consume",
        entity: "MinibarRecord",
        entityId: record.id,
        newValue: {
          roomNumber: input.roomNumber,
          productId: product.id,
          quantity: qty.toString(),
          note: "No room charge created",
        },
      },
    });

    return tx.minibarRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { product: true },
    });
  });
}
