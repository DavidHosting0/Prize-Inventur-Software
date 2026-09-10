import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import { bottlesToMl } from "./liquid-stock";
import { writeAuditLog } from "./audit";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import type { CreateGoodsReceiptInput } from "@prize/validators";
import { getCentralWarehouse } from "./warehouse";

function d(n: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(n);
}

export async function createGoodsReceipt(
  user: SessionUser,
  input: CreateGoodsReceiptInput
) {
  assertSessionHotelId(user);
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, hotelId: user.hotelId },
  });
  if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");

  const warehouse = await getCentralWarehouse(user.hotelId);
  void input.warehouseId;

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { hotelId: user.hotelId, id: { in: productIds } },
  });
  if (products.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");

  const receipt = await prisma.goodsReceipt.create({
    data: {
      hotelId: user.hotelId,
      warehouseId: warehouse.id,
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      deliveryNoteNo: input.deliveryNoteNo ?? null,
      notes: input.notes ?? null,
      status: "DRAFT",
      createdById: user.id,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      items: {
        create: input.items.map((item) => {
          const missing =
            item.qtyMissing ??
            Math.max(0, item.qtyOrdered - item.qtyDelivered);
          return {
            productId: item.productId,
            qtyOrdered: d(item.qtyOrdered),
            qtyDelivered: d(item.qtyDelivered),
            qtyDamaged: d(item.qtyDamaged ?? 0),
            qtyMissing: d(missing),
            purchasePrice: d(item.purchasePrice),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            batchNo: item.batchNo ?? null,
          };
        }),
      },
    },
    include: {
      items: { include: { product: true } },
      supplier: true,
      warehouse: true,
    },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "goodsReceipt.create",
    entity: "GoodsReceipt",
    entityId: receipt.id,
    newValue: {
      status: "DRAFT",
      supplierId: receipt.supplierId,
      itemCount: receipt.items.length,
    },
  });

  return receipt;
}

/**
 * Confirm receipt: stock increases by (delivered - damaged) only on central Lager.
 * True idempotency: concurrent confirms claim DRAFT once; already CONFIRMED returns existing.
 */
export async function confirmGoodsReceipt(user: SessionUser, receiptId: string) {
  assertSessionHotelId(user);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.goodsReceipt.updateMany({
      where: { id: receiptId, hotelId: user.hotelId, status: "DRAFT" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    if (claimed.count === 0) {
      const existing = await tx.goodsReceipt.findFirst({
        where: { id: receiptId, hotelId: user.hotelId },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
        },
      });
      if (!existing) throw new Error("RECEIPT_NOT_FOUND");
      if (existing.status === "CONFIRMED") return existing;
      if (existing.status === "CANCELLED") throw new Error("RECEIPT_CANCELLED");
      throw new Error("RECEIPT_NOT_CONFIRMABLE");
    }

    const receipt = await tx.goodsReceipt.findFirstOrThrow({
      where: { id: receiptId, hotelId: user.hotelId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                trackLiquid: true,
                bottleContentMl: true,
              },
            },
          },
        },
      },
    });

    const warehouse = await getCentralWarehouse(user.hotelId, tx);

    for (const item of receipt.items) {
      const received = item.qtyDelivered.sub(item.qtyDamaged);
      if (received.lte(0)) continue;

      const stockQty = bottlesToMl(item.product, received);

      await applyStockChange(tx, {
        hotelId: user.hotelId,
        productId: item.productId,
        warehouseId: warehouse.id,
        userId: user.id,
        delta: stockQty,
        type: "PURCHASE",
        reason: `Wareneingang ${receipt.deliveryNoteNo ?? receipt.id}`,
        referenceType: "GoodsReceipt",
        referenceId: receipt.id,
      });

      await tx.product.update({
        where: { id: item.productId },
        data: { purchasePrice: item.purchasePrice },
      });

      await tx.supplierProduct.create({
        data: {
          supplierId: receipt.supplierId,
          productId: item.productId,
          purchasePrice: item.purchasePrice,
        },
      });
    }

    if (receipt.warehouseId !== warehouse.id) {
      await tx.goodsReceipt.update({
        where: { id: receipt.id },
        data: { warehouseId: warehouse.id },
      });
    }

    if (receipt.purchaseOrderId) {
      await tx.purchaseOrder.update({
        where: { id: receipt.purchaseOrderId },
        data: { status: "RECEIVED" },
      });
    }

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "goodsReceipt.confirm",
        entity: "GoodsReceipt",
        entityId: receipt.id,
        oldValue: { status: "DRAFT" },
        newValue: { status: "CONFIRMED", items: receipt.items.length },
      },
    });

    return tx.goodsReceipt.findFirstOrThrow({
      where: { id: receipt.id },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
      },
    });
  });
}
