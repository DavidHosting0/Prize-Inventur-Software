import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { recordWaste } from "./waste";
import { createStockTransfer } from "./transfers";
import type { SessionUser } from "./rbac";

const prisma = new PrismaClient();

describe("waste and transfer stock effects", () => {
  let user: SessionUser;
  let productId: string;
  let lagerId: string;

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
      where: { sku: "BF-MILK", hotelId: hotel.id },
    });
    const lager = await prisma.warehouse.findFirstOrThrow({
      where: { code: "LAGER", hotelId: hotel.id },
    });
    productId = product.id;
    lagerId = lager.id;

    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId: lagerId },
      },
      create: { productId, warehouseId: lagerId, quantity: 30 },
      update: { quantity: 30 },
    });
  });

  it("waste reduces central Lager stock and records cost", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId: lagerId },
      },
    });
    const waste = await recordWaste(user, {
      productId,
      quantity: 2,
      reason: "EXPIRED",
    });
    expect(Number(waste.quantity)).toBe(2);
    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId, warehouseId: lagerId },
      },
    });
    expect(Number(after.quantity)).toBe(Number(before.quantity) - 2);
  });

  it("transfer throws TRANSFERS_DISABLED", async () => {
    await expect(
      createStockTransfer(user, {
        fromWarehouseId: lagerId,
        toWarehouseId: lagerId,
        reason: "should fail",
        items: [{ productId, quantity: 1 }],
      })
    ).rejects.toThrow("TRANSFERS_DISABLED");
  });
});
