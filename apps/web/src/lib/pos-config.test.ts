import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPendingSale, paySale, cancelSale } from "./sales";
import type { SessionUser } from "./rbac";
import { loadPosBootstrap } from "./pos-bootstrap";
import {
  createPosArticleFromProduct,
  createPosArticleFromRecipe,
  getPosArticle,
  listPosArticles,
} from "./pos-config";
import { hasPermission } from "./rbac";

const prisma = new PrismaClient();

async function loadUser(email: string): Promise<SessionUser> {
  const userRow = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      hotels: { include: { hotel: true }, take: 1 },
    },
  });
  const hotel = userRow.hotels[0]!.hotel;
  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    username: userRow.username,
    roleCode: userRow.role.code,
    accountType: userRow.accountType,
    organizationId: hotel.organizationId,
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    permissions: userRow.role.permissions.map(
      (rp) => rp.permission.code as SessionUser["permissions"][number]
    ),
    locale: "de",
    currency: hotel.currency,
    hotelLocale: hotel.locale,
    hotelName: hotel.name,
  };
}

describe("POS config + recipe stock", () => {
  let admin: SessionUser;
  let barUser: SessionUser;
  let productId: string;
  let warehouseId: string;
  let posArticleId: string;
  let ingredientA: string;
  let ingredientB: string;

  beforeAll(async () => {
    admin = await loadUser("admin@demo-hotel.ch");
    barUser = await loadUser("bar@demo-hotel.ch");

    const product = await prisma.product.findFirstOrThrow({
      where: { hotelId: admin.hotelId!, sku: "BEV-WATER-05" },
    });
    productId = product.id;
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "LAGER", hotelId: admin.hotelId! },
    });
    warehouseId = warehouse.id;

    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: { productId, warehouseId, quantity: 100 },
      update: { quantity: 100 },
    });

    let article = await prisma.posArticle.findFirst({
      where: {
        hotelId: admin.hotelId!,
        productId,
        type: "PRODUCT",
        isActive: true,
      },
    });
    if (!article) {
      article = await createPosArticleFromProduct(admin, {
        productId,
        salePrice: Number(product.salePrice),
      });
    }
    posArticleId = article.id;

    const coke = await prisma.product.findFirstOrThrow({
      where: { hotelId: admin.hotelId!, sku: "BEV-COKE-033" },
    });
    const beer = await prisma.product.findFirstOrThrow({
      where: { hotelId: admin.hotelId!, sku: "BAR-BEER-033" },
    });
    ingredientA = coke.id;
    ingredientB = beer.id;
    for (const pid of [ingredientA, ingredientB]) {
      await prisma.stockLevel.upsert({
        where: {
          productId_warehouseId: { productId: pid, warehouseId },
        },
        create: { productId: pid, warehouseId, quantity: 50 },
        update: { quantity: 50 },
      });
    }
  });

  it("pays PRODUCT PosArticle with one stock movement", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    const sale = await createPendingSale(admin, {
      items: [{ posArticleId, quantity: 1 }],
    });
    const paid = await paySale(admin, sale.id, { method: "CARD" });
    expect(paid.status).toBe("PAID");

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    expect(after.quantity.equals(before.quantity.sub(1))).toBe(true);

    const movements = await prisma.inventoryMovement.count({
      where: { referenceId: sale.id, type: "SALE" },
    });
    expect(movements).toBe(1);
  });

  it("pays RECIPE PosArticle exploding ingredients", async () => {
    const recipe = await prisma.recipe.create({
      data: {
        hotelId: admin.hotelId!,
        name: `Test Mix ${Date.now()}`,
        isActive: true,
        items: {
          create: [
            { productId: ingredientA, quantity: 1, unit: "PIECE", sortOrder: 0 },
            { productId: ingredientB, quantity: 2, unit: "PIECE", sortOrder: 1 },
          ],
        },
      },
    });

    const article = await createPosArticleFromRecipe(admin, {
      recipeId: recipe.id,
      salePrice: 12.5,
      vatRate: 8.1,
    });

    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: { productId: ingredientA, warehouseId },
      },
      data: { quantity: 50 },
    });
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: { productId: ingredientB, warehouseId },
      },
      data: { quantity: 50 },
    });

    const sale = await createPendingSale(admin, {
      items: [{ posArticleId: article.id, quantity: 1 }],
    });
    expect(sale.items[0]?.recipeId).toBe(recipe.id);
    expect(sale.items[0]?.productId).toBeNull();
    expect(sale.status).toBe("PENDING");

    const paid = await paySale(admin, sale.id, { method: "CASH" });
    expect(paid.status).toBe("PAID");

    const afterA = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId: ingredientA, warehouseId },
      },
    });
    const afterB = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId: ingredientB, warehouseId },
      },
    });
    expect(Number(afterA.quantity)).toBe(49);
    expect(Number(afterB.quantity)).toBe(48);

    const movements = await prisma.inventoryMovement.count({
      where: { referenceId: sale.id, type: "SALE" },
    });
    expect(movements).toBe(2);
  });

  it("cancel pending recipe sale does not consume stock", async () => {
    const recipe = await prisma.recipe.create({
      data: {
        hotelId: admin.hotelId!,
        name: `Cancel Mix ${Date.now()}`,
        isActive: true,
        items: {
          create: [
            { productId: ingredientA, quantity: 1, unit: "PIECE", sortOrder: 0 },
          ],
        },
      },
    });
    const article = await createPosArticleFromRecipe(admin, {
      recipeId: recipe.id,
      salePrice: 5,
    });
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: { productId: ingredientA, warehouseId },
      },
      data: { quantity: 40 },
    });
    const sale = await createPendingSale(admin, {
      items: [{ posArticleId: article.id, quantity: 1 }],
    });
    await cancelSale(admin, sale.id);
    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        productId_warehouseId: { productId: ingredientA, warehouseId },
      },
    });
    expect(Number(after.quantity)).toBe(40);
  });

  it("double pay does not double-consume", async () => {
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    const sale = await createPendingSale(admin, {
      items: [{ posArticleId, quantity: 1 }],
    });
    await paySale(admin, sale.id, { method: "CARD" });
    await expect(paySale(admin, sale.id, { method: "CARD" })).rejects.toThrow(
      /SALE_NOT_PAYABLE/
    );
    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    expect(after.quantity.equals(before.quantity.sub(1))).toBe(true);
  });

  it("inactive PosArticle is excluded from bootstrap", async () => {
    await prisma.posArticle.update({
      where: { id: posArticleId },
      data: { isActive: false },
    });
    try {
      const boot = await loadPosBootstrap(admin.hotelId!);
      expect(boot.products.some((p) => p.posArticleId === posArticleId)).toBe(
        false
      );
    } finally {
      await prisma.posArticle.update({
        where: { id: posArticleId },
        data: { isActive: true },
      });
    }
  });

  it("BAR lacks pos_config permissions", () => {
    expect(hasPermission(barUser, "pos_config.view")).toBe(false);
    expect(hasPermission(barUser, "pos_config.create")).toBe(false);
    expect(hasPermission(barUser, "pos_config.manage_layout")).toBe(false);
  });

  it("hotel A cannot read hotel B pos article", async () => {
    const zurich = await prisma.hotel.findFirstOrThrow({
      where: {
        name: "Prize Zurich",
        organizationId: admin.organizationId,
      },
    });
    let foreign = await prisma.posArticle.findFirst({
      where: { hotelId: zurich.id },
    });
    if (!foreign) {
      foreign = await prisma.posArticle.create({
        data: {
          hotelId: zurich.id,
          type: "PRODUCT",
          name: "Zurich Only",
          salePrice: 9,
          vatRate: 8.1,
          isActive: true,
          sortOrder: 0,
        },
      });
    }
    await expect(getPosArticle(admin, foreign.id)).rejects.toThrow();
    const listed = await listPosArticles(admin, {});
    expect(listed.every((a) => a.hotelId === admin.hotelId)).toBe(true);
  });
});
