import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { getCentralWarehouse } from "./warehouse";
import { bottleContent, bottlesToMl } from "./liquid-stock";
import { getHotelInventorySettings } from "./inventory-settings";
import type { InventorySettingsJson } from "@prize/types";

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

async function uncountedCount(
  tx: Prisma.TransactionClient,
  countId: string
): Promise<number> {
  return tx.inventoryCountItem.count({
    where: { countId, countedQty: null },
  });
}

export async function submitInventoryForReview(
  user: SessionUser,
  countId: string
) {
  assertSessionHotelId(user);
  const settings = await getHotelInventorySettings(user.hotelId);

  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, hotelId: user.hotelId },
    });
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status !== "IN_PROGRESS" && count.status !== "DRAFT") {
      throw new Error("COUNT_NOT_IN_PROGRESS");
    }

    if (!settings.allowCloseWithUncounted) {
      const left = await uncountedCount(tx, countId);
      if (left > 0) throw new Error("UNCOUNTED_ITEMS_REMAIN");
    }

    const updated = await tx.inventoryCount.update({
      where: { id: count.id },
      data: { status: "REVIEW" },
      include: { items: { include: { product: true } }, warehouse: true },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "inventory.review",
        entity: "InventoryCount",
        entityId: count.id,
        newValue: { status: "REVIEW" },
      },
    });

    return updated;
  });
}

export async function reopenInventoryCount(
  user: SessionUser,
  countId: string
) {
  assertSessionHotelId(user);

  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, hotelId: user.hotelId },
    });
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status !== "REVIEW") throw new Error("COUNT_NOT_IN_REVIEW");

    const updated = await tx.inventoryCount.update({
      where: { id: count.id },
      data: { status: "IN_PROGRESS" },
      include: { items: { include: { product: true } }, warehouse: true },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "inventory.reopen",
        entity: "InventoryCount",
        entityId: count.id,
        newValue: { status: "IN_PROGRESS" },
      },
    });

    return updated;
  });
}

function applyUncountedPolicy(
  settings: InventorySettingsJson,
  item: {
    countedQty: Prisma.Decimal | null;
    systemQty: Prisma.Decimal;
    product: { purchasePrice: Prisma.Decimal; trackLiquid: boolean; bottleContentMl: Prisma.Decimal | null };
  }
): {
  countedQty: Prisma.Decimal;
  difference: Prisma.Decimal;
  valueDiff: Prisma.Decimal;
} | null {
  if (item.countedQty != null) return null;
  if (!settings.allowCloseWithUncounted) {
    throw new Error("UNCOUNTED_ITEMS_REMAIN");
  }
  if (!settings.uncountedMeansZero) {
    // Leave stock unchanged — skip adjustment
    return null;
  }
  const counted = new Prisma.Decimal(0);
  const difference = counted.sub(item.systemQty);
  const content = bottleContent(item.product);
  const valueDiff =
    content != null
      ? difference.div(content).mul(item.product.purchasePrice)
      : difference.mul(item.product.purchasePrice);
  return { countedQty: counted, difference, valueDiff };
}

export async function closeInventoryCount(user: SessionUser, countId: string) {
  assertSessionHotelId(user);
  const settings = await getHotelInventorySettings(user.hotelId);

  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, hotelId: user.hotelId },
      include: { items: { include: { product: true } } },
    });
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status === "CLOSED") throw new Error("COUNT_ALREADY_CLOSED");

    if (
      settings.requireReviewBeforeClose &&
      count.status !== "REVIEW"
    ) {
      throw new Error("REVIEW_REQUIRED");
    }

    if (!settings.allowCloseWithUncounted) {
      const left = await uncountedCount(tx, countId);
      if (left > 0) throw new Error("UNCOUNTED_ITEMS_REMAIN");
    }

    const warehouse = await getCentralWarehouse(user.hotelId, tx);
    const warehouseId = count.warehouseId ?? warehouse.id;

    for (const item of count.items) {
      let countedQty = item.countedQty;
      let difference =
        item.difference ??
        (item.countedQty != null
          ? item.countedQty.sub(item.systemQty)
          : null);

      if (countedQty == null) {
        const filled = applyUncountedPolicy(settings, item);
        if (!filled) continue;
        countedQty = filled.countedQty;
        difference = filled.difference;
        await tx.inventoryCountItem.update({
          where: { id: item.id },
          data: {
            countedQty: filled.countedQty,
            difference: filled.difference,
            valueDiff: filled.valueDiff,
            countedAt: new Date(),
          },
        });
      }

      if (difference == null || difference.isZero()) continue;

      await applyStockChange(tx, {
        hotelId: user.hotelId,
        productId: item.productId,
        warehouseId,
        userId: user.id,
        delta: difference,
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

export type InventoryCountProgress = {
  itemCount: number;
  countedCount: number;
  diffCount: number;
  valueDiffSum: number;
};

export async function loadInventoryProgress(
  hotelId: string,
  countIds: string[]
): Promise<Map<string, InventoryCountProgress>> {
  const map = new Map<string, InventoryCountProgress>();
  for (const id of countIds) {
    map.set(id, {
      itemCount: 0,
      countedCount: 0,
      diffCount: 0,
      valueDiffSum: 0,
    });
  }
  if (countIds.length === 0) return map;

  const items = await prisma.inventoryCountItem.findMany({
    where: {
      countId: { in: countIds },
      count: { hotelId },
    },
    select: {
      countId: true,
      countedQty: true,
      difference: true,
      valueDiff: true,
    },
  });

  for (const item of items) {
    const row = map.get(item.countId);
    if (!row) continue;
    row.itemCount += 1;
    if (item.countedQty != null) {
      row.countedCount += 1;
      if (item.difference != null && !item.difference.isZero()) {
        row.diffCount += 1;
      }
      if (item.valueDiff != null) {
        row.valueDiffSum += Math.abs(Number(item.valueDiff));
      }
    }
  }

  return map;
}
