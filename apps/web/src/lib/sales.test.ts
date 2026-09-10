import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPendingSale, paySale, cancelSale } from "./sales";
import type { SessionUser } from "./rbac";

const prisma = new PrismaClient();

describe("POS payment stock invariants", () => {
  let user: SessionUser;
  let productId: string;
  let warehouseId: string;

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
      where: { sku: "BEV-WATER-05" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "LAGER", hotelId: hotel.id },
    });
    productId = product.id;
    warehouseId = warehouse.id;
    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: { productId, warehouseId, quantity: 80 },
      update: {},
    });
  });

  it("does not reduce stock on PENDING or CANCELLED", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });

    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 1 }],
    });
    expect(sale.status).toBe("PENDING");

    const mid = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });
    expect(mid.quantity.equals(before.quantity)).toBe(true);

    await cancelSale(user, sale.id);
    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });
    expect(after.quantity.equals(before.quantity)).toBe(true);
  });

  it("reduces stock exactly once on PAID", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });

    const sale = await createPendingSale(user, {
      items: [{ productId, quantity: 2 }],
    });
    const paid = await paySale(user, sale.id, { method: "CARD" });
    expect(paid.status).toBe("PAID");

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });
    expect(after.quantity.equals(before.quantity.sub(2))).toBe(true);

    const movements = await prisma.inventoryMovement.count({
      where: { referenceId: sale.id, type: "SALE" },
    });
    expect(movements).toBe(1);
  });
});
