import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { getCentralWarehouse } from "./warehouse";

export const WASTE_REASONS = [
  "EXPIRED",
  "OVERPRODUCTION",
  "DAMAGED",
  "INCORRECTLY_PREPARED",
  "BUFFET_LEFTOVERS",
  "OTHER",
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export async function recordWaste(
  user: SessionUser,
  input: {
    productId: string;
    warehouseId?: string;
    quantity: number;
    reason: WasteReason | string;
  }
) {
  assertSessionHotelId(user);
  const product = await prisma.product.findFirst({
    where: { id: input.productId, hotelId: user.hotelId },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const warehouse = await getCentralWarehouse(user.hotelId);
  void input.warehouseId;

  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) throw new Error("INVALID_QUANTITY");
  const costValue = qty.mul(product.purchasePrice);

  return prisma.$transaction(async (tx) => {
    const waste = await tx.waste.create({
      data: {
        hotelId: user.hotelId,
        productId: product.id,
        quantity: qty,
        reason: input.reason,
        costValue,
      },
    });

    await applyStockChange(tx, {
      hotelId: user.hotelId,
      productId: product.id,
      warehouseId: warehouse.id,
      userId: user.id,
      delta: qty.neg(),
      type: "WASTE",
      reason: `Food waste: ${input.reason}`,
      referenceType: "Waste",
      referenceId: waste.id,
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "waste.create",
        entity: "Waste",
        entityId: waste.id,
        newValue: {
          productId: product.id,
          quantity: qty.toString(),
          reason: input.reason,
          costValue: costValue.toString(),
        },
      },
    });

    return tx.waste.findUniqueOrThrow({
      where: { id: waste.id },
      include: { product: true },
    });
  });
}
