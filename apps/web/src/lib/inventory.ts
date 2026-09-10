import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { getCentralWarehouse } from "./warehouse";
import { bottleContent, bottlesToMl } from "./liquid-stock";

export async function createInventoryCount(
  user: SessionUser,
  input: {
    name: string;
    warehouseId?: string | null;
    categoryId?: string | null;
    productIds?: string[];
  }
) {
  assertSessionHotelId(user);
  const warehouse = await getCentralWarehouse(user.hotelId);
  const warehouseId = warehouse.id;
  void input.warehouseId;

  const products = await prisma.product.findMany({
    where: {
      hotelId: user.hotelId,
      isActive: true,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.productIds?.length ? { id: { in: input.productIds } } : {}),
    },
  });

  const stocks = await prisma.stockLevel.findMany({
    where: {
      warehouseId,
      productId: { in: products.map((p) => p.id) },
    },
  });
  const stockMap = new Map(stocks.map((s) => [s.productId, s.quantity]));

  return prisma.inventoryCount.create({
    data: {
      hotelId: user.hotelId,
      warehouseId,
      categoryId: input.categoryId ?? null,
      name: input.name,
      status: "IN_PROGRESS",
      createdById: user.id,
      startedAt: new Date(),
      items: {
        create: products.map((p) => ({
          productId: p.id,
          systemQty: stockMap.get(p.id) ?? new Prisma.Decimal(0),
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      warehouse: true,
    },
  });
}

export async function countInventoryItem(
  user: SessionUser,
  countId: string,
  productId: string,
  countedQty: number
) {
  assertSessionHotelId(user);
  const count = await prisma.inventoryCount.findFirst({
    where: { id: countId, hotelId: user.hotelId },
  });
  if (!count) throw new Error("COUNT_NOT_FOUND");
  if (!["IN_PROGRESS", "REVIEW", "DRAFT"].includes(count.status)) {
    throw new Error("COUNT_NOT_EDITABLE");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, hotelId: user.hotelId },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const warehouse = await getCentralWarehouse(user.hotelId);
  const warehouseId = count.warehouseId ?? warehouse.id;

  let item = await prisma.inventoryCountItem.findUnique({
    where: { countId_productId: { countId, productId } },
    include: { product: true },
  });

  // Product exists in catalog but was not on the original count sheet — add it
  if (!item) {
    const stock = await prisma.stockLevel.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });
    item = await prisma.inventoryCountItem.create({
      data: {
        countId,
        productId,
        systemQty: stock?.quantity ?? new Prisma.Decimal(0),
      },
      include: { product: true },
    });
  }

  // Liquid products: UI enters bottles; store countedQty in ml (stock unit).
  const counted = bottlesToMl(product, countedQty);
  const difference = counted.sub(item.systemQty);
  const content = bottleContent(product);
  const valueDiff =
    content != null
      ? difference.div(content).mul(item.product.purchasePrice)
      : difference.mul(item.product.purchasePrice);

  return prisma.inventoryCountItem.update({
    where: { id: item.id },
    data: {
      countedQty: counted,
      difference,
      valueDiff,
      countedAt: new Date(),
    },
    include: { product: true },
  });
}

export async function closeInventoryCount(user: SessionUser, countId: string) {
  assertSessionHotelId(user);
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, hotelId: user.hotelId },
      include: { items: { include: { product: true } } },
    });
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status === "CLOSED") throw new Error("COUNT_ALREADY_CLOSED");

    const warehouse = await getCentralWarehouse(user.hotelId, tx);
    const warehouseId = count.warehouseId ?? warehouse.id;

    for (const item of count.items) {
      if (item.countedQty == null) continue;
      const diff = item.countedQty.sub(item.systemQty);
      if (diff.isZero()) continue;

      await applyStockChange(tx, {
        hotelId: user.hotelId,
        productId: item.productId,
        warehouseId,
        userId: user.id,
        delta: diff,
        type: "INVENTORY_ADJUSTMENT",
        reason: `Inventur: ${count.name}`,
        referenceType: "InventoryCount",
        referenceId: count.id,
      });
    }

    const updated = await tx.inventoryCount.update({
      where: { id: count.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        warehouseId,
      },
      include: { items: { include: { product: true } }, warehouse: true },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "inventory.close",
        entity: "InventoryCount",
        entityId: count.id,
        newValue: { status: "CLOSED", items: count.items.length },
      },
    });

    return updated;
  });
}
