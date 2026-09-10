import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPendingSale, paySale } from "./sales";
import { confirmGoodsReceipt, createGoodsReceipt } from "./goods-receipts";
import { parseCalendarDate } from "./breakfast";
import type { SessionUser } from "./rbac";

const prisma = new PrismaClient();

describe("concurrency and integrity", () => {
  let user: SessionUser;
  let productId: string;
  let warehouseId: string;
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
    const product = await prisma.product.findFirstOrThrow({
      where: { sku: "BEV-WATER-05", hotelId: hotel.id },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "LAGER", hotelId: hotel.id },
    });
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { hotelId: hotel.id },
    });
    productId = product.id;
    warehouseId = warehouse.id;
    supplierId = supplier.id;

    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: { productId, warehouseId, quantity: 50 },
      update: { quantity: 50 },
    });
  });

  it("rejects a second concurrent pay (only one stock reduction)", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 1 }],
    });

    const results = await Promise.allSettled([
      paySale(user, sale.id, { method: "CARD" }),
      paySale(user, sale.id, { method: "CASH" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) - 1);

    const payments = await prisma.payment.count({ where: { saleId: sale.id } });
    expect(payments).toBe(1);

    const movements = await prisma.inventoryMovement.count({
      where: { referenceId: sale.id, type: "SALE" },
    });
    expect(movements).toBe(1);
  });

  it("confirm goods receipt is idempotent and stock increases once", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    const receipt = await createGoodsReceipt(user, {
      supplierId,
      deliveryNoteNo: `DN-TEST-${Date.now()}`,
      items: [
        {
          productId,
          qtyOrdered: 5,
          qtyDelivered: 5,
          qtyDamaged: 0,
          purchasePrice: 0.5,
        },
      ],
    });

    const [a, b] = await Promise.all([
      confirmGoodsReceipt(user, receipt.id),
      confirmGoodsReceipt(user, receipt.id),
    ]);
    expect(a.status).toBe("CONFIRMED");
    expect(b.status).toBe("CONFIRMED");
    expect(a.id).toBe(b.id);

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) + 5);

    const purchaseMoves = await prisma.inventoryMovement.count({
      where: { referenceId: receipt.id, type: "PURCHASE" },
    });
    expect(purchaseMoves).toBe(1);
  });

  it("parses breakfast calendar dates without TZ day shift", () => {
    const d = parseCalendarDate("2026-03-09");
    expect(d.toISOString().startsWith("2026-03-09")).toBe(true);
  });
});
