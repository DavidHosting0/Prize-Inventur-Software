import { Prisma } from "@prisma/client";
import type { Unit } from "@prisma/client";
import { prisma } from "./db";
import { writeAuditLog } from "./audit";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { recipeLineCost } from "./liquid-stock";

export async function createRecipe(
  user: SessionUser,
  input: {
    name: string;
    items: { productId: string; quantity: number; unit: Unit }[];
    instructions?: string | null;
  }
) {
  assertSessionHotelId(user);
  if (!input.items.length) throw new Error("NO_ITEMS");

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { hotelId: user.hotelId, id: { in: productIds } },
  });
  if (products.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");

  const instructions =
    input.instructions == null
      ? null
      : String(input.instructions).trim() || null;

  const recipe = await prisma.recipe.create({
    data: {
      hotelId: user.hotelId,
      name: input.name,
      version: 1,
      isActive: true,
      instructions,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          quantity: new Prisma.Decimal(i.quantity),
          unit: i.unit,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "recipe.create",
    entity: "Recipe",
    entityId: recipe.id,
    newValue: { name: recipe.name, version: 1 },
  });

  return recipe;
}

/** Create a new version of an existing recipe (deactivate old). */
export async function versionRecipe(
  user: SessionUser,
  recipeId: string,
  input: {
    name?: string;
    items: { productId: string; quantity: number; unit: Unit }[];
  }
) {
  assertSessionHotelId(user);
  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, hotelId: user.hotelId },
  });
  if (!existing) throw new Error("RECIPE_NOT_FOUND");
  if (!input.items.length) throw new Error("NO_ITEMS");

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { hotelId: user.hotelId, id: { in: productIds } },
  });
  if (products.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    const next = await tx.recipe.create({
      data: {
        hotelId: user.hotelId,
        name: input.name ?? existing.name,
        version: existing.version + 1,
        isActive: true,
        instructions: existing.instructions,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: new Prisma.Decimal(i.quantity),
            unit: i.unit,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "recipe.version",
        entity: "Recipe",
        entityId: next.id,
        oldValue: { id: existing.id, version: existing.version },
        newValue: { id: next.id, version: next.version },
      },
    });

    return next;
  });
}

export async function theoreticalConsumption(
  hotelId: string,
  recipeId: string,
  servings: number
) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, hotelId, isActive: true },
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");

  return recipe.items.map((item) => ({
    productId: item.productId,
    name: item.product.name,
    unit: item.unit,
    quantity: Number(item.quantity) * servings,
    cost:
      Number(item.quantity) * servings * Number(item.product.purchasePrice),
  }));
}

export async function updateRecipeInPlace(
  user: SessionUser,
  recipeId: string,
  input: {
    name?: string;
    isActive?: boolean;
    instructions?: string | null;
    items?: { productId: string; quantity: number; unit: Unit; sortOrder?: number }[];
  }
) {
  assertSessionHotelId(user);
  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, hotelId: user.hotelId },
  });
  if (!existing) throw new Error("RECIPE_NOT_FOUND");

  if (input.items) {
    if (!input.items.length) throw new Error("NO_ITEMS");
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { hotelId: user.hotelId, id: { in: productIds } },
    });
    if (products.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");
  }

  const instructions =
    input.instructions === undefined
      ? undefined
      : input.instructions == null
        ? null
        : String(input.instructions).trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.recipeItem.deleteMany({ where: { recipeId } });
      await tx.recipeItem.createMany({
        data: input.items.map((i, idx) => ({
          recipeId,
          productId: i.productId,
          quantity: new Prisma.Decimal(i.quantity),
          unit: i.unit,
          sortOrder: i.sortOrder ?? idx,
        })),
      });
    }
    return tx.recipe.update({
      where: { id: recipeId },
      data: {
        name: input.name ?? existing.name,
        isActive: input.isActive ?? existing.isActive,
        ...(instructions !== undefined ? { instructions } : {}),
      },
      include: {
        items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        posArticles: true,
      },
    });
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "recipe.update",
    entity: "Recipe",
    entityId: recipeId,
    newValue: {
      name: updated.name,
      isActive: updated.isActive,
      instructions: updated.instructions,
    },
  });

  return updated;
}

export async function duplicateRecipe(user: SessionUser, recipeId: string) {
  assertSessionHotelId(user);
  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, hotelId: user.hotelId },
    include: { items: true },
  });
  if (!existing) throw new Error("RECIPE_NOT_FOUND");
  return createRecipe(user, {
    name: `${existing.name} (Kopie)`,
    instructions: existing.instructions,
    items: existing.items.map((i) => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      unit: i.unit,
    })),
  });
}

export async function recipeCostSummary(hotelId: string, recipeId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, hotelId },
    include: {
      items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      posArticles: { where: { isActive: true }, take: 1 },
    },
  });
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  const foodCost = recipe.items.reduce(
    (sum, i) =>
      sum +
      recipeLineCost(
        {
          trackLiquid: i.product.trackLiquid,
          bottleContentMl: i.product.bottleContentMl,
          purchasePrice: i.product.purchasePrice,
        },
        i.quantity,
        i.unit
      ),
    0
  );
  const salePrice = recipe.posArticles[0]
    ? Number(recipe.posArticles[0].salePrice)
    : null;
  const margin = salePrice != null ? salePrice - foodCost : null;
  const foodCostPct =
    salePrice && salePrice > 0 ? (foodCost / salePrice) * 100 : null;
  return {
    recipe,
    foodCost,
    salePrice,
    margin,
    foodCostPct,
  };
}
