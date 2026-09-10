import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createPendingSale,
  paySale,
  refundSale,
} from "./sales";
import { createGoodsReceipt, confirmGoodsReceipt } from "./goods-receipts";
import {
  createInventoryCount,
  countInventoryItem,
  closeInventoryCount,
} from "./inventory";
import { recordWaste } from "./waste";
import { createStockTransfer } from "./transfers";
import { CENTRAL_WAREHOUSE_CODE } from "./warehouse";
import type { SessionUser } from "./rbac";

const prisma = new PrismaClient();

describe("single central Lager architecture", () => {
  let user: SessionUser;
  let hotelId: string;
  let lagerId: string;
  let productId: string;
  let supplierId: string;

  beforeAll(async () => {
    const userRow = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@demo-hotel.ch" },
      include: {
        role: true,
        hotels: { include: { hotel: true }, take: 1 },
      },
    });
    const hotel = userRow.hotels[0]!.hotel;
    hotelId = hotel.id;
    user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      username: userRow.username,
      roleCode: userRow.role.code,
      accountType: "HOTEL",
      organizationId: hotel.organizationId,
      hotelId: hotel.id,
      hotelSlug: hotel.slug,
      permissions: [],
      locale: "de",
      currency: hotel.currency,
      hotelLocale: hotel.locale,
      hotelName: hotel.name,
    };

    const lager = await prisma.warehouse.findFirstOrThrow({
      where: { code: CENTRAL_WAREHOUSE_CODE, hotelId },
    });
    lagerId = lager.id;

    const product = await prisma.product.findFirstOrThrow({
      where: { sku: "BEV-COKE-033", hotelId },
    });
    productId = product.id;

    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { hotelId },
    });
    supplierId = supplier.id;

    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId: lagerId },
      },
      create: { productId, warehouseId: lagerId, quantity: 100 },
      update: { quantity: 100 },
    });
  });

  it("has only one active warehouse (LAGER) per hotel", async () => {
    const active = await prisma.warehouse.findMany({
      where: { hotelId, isActive: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.code).toBe("LAGER");
    expect(active[0]!.name).toBe("Lager");
  });

  it("product stock is unambiguous (one StockLevel on LAGER)", async () => {
    const levels = await prisma.stockLevel.findMany({
      where: { productId },
      include: { warehouse: true },
    });
    expect(levels).toHaveLength(1);
    expect(levels[0]!.warehouseId).toBe(lagerId);
    expect(levels[0]!.warehouse.code).toBe("LAGER");
  });

  it("goods receiving increases central stock", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });

    const receipt = await createGoodsReceipt(user, {
      supplierId,
      deliveryNoteNo: `DN-LAGER-${Date.now()}`,
      items: [
        {
          productId,
          qtyOrdered: 10,
          qtyDelivered: 10,
          qtyDamaged: 0,
          purchasePrice: 0.85,
        },
      ],
    });
    await confirmGoodsReceipt(user, receipt.id);

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) + 10);
  });

  it("inventory counting adjusts central stock", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    const target = Number(before.quantity) - 1;

    const count = await createInventoryCount(user, {
      name: `Lager count ${Date.now()}`,
      productIds: [productId],
    });
    await countInventoryItem(user, count.id, productId, target);
    await closeInventoryCount(user, count.id);

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(after.quantity)).toBe(target);
  });

  it("POS pay reduces central stock", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });

    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 2 }],
    });
    expect(sale.warehouseId).toBe(lagerId);
    await paySale(user, sale.id, { method: "CARD" });

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) - 2);
  });

  it("waste reduces central stock", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });

    await recordWaste(user, {
      productId,
      quantity: 1,
      reason: "DAMAGED",
    });

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) - 1);
  });

  it("refund restores central stock", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });

    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 1 }],
    });
    await paySale(user, sale.id, { method: "CASH" });
    const afterPay = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(afterPay.quantity)).toBe(Number(before.quantity) - 1);

    await refundSale(user, sale.id, "test refund");

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: lagerId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity));
  });

  it("transfers throw TRANSFERS_DISABLED", async () => {
    await expect(
      createStockTransfer(user, {
        fromWarehouseId: lagerId,
        toWarehouseId: lagerId,
        reason: "disabled",
        items: [{ productId, quantity: 1 }],
      })
    ).rejects.toThrow("TRANSFERS_DISABLED");
  });

  it("createPendingSale works without warehouseId", async () => {
    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 1 }],
    });
    expect(sale.status).toBe("PENDING");
    expect(sale.warehouseId).toBe(lagerId);
  });
});
