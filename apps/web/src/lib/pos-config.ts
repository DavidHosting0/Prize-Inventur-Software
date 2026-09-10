import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/rbac";
import { assertSessionHotelId } from "@/lib/tenant";
import type {
  PosArticleCreateFromProductInput,
  PosArticleCreateFromRecipeInput,
  PosArticleUpdateInput,
  PosCategoryInput,
} from "@prize/validators";

function d(n: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(n);
}

export async function getPosConfigOverview(user: SessionUser) {
  assertSessionHotelId(user);
  const hotelId = user.hotelId;
  const [categories, articles, activeArticles, recipes, productArticles, recipeArticles] =
    await Promise.all([
      prisma.posCategory.count({ where: { hotelId } }),
      prisma.posArticle.count({ where: { hotelId } }),
      prisma.posArticle.count({ where: { hotelId, isActive: true } }),
      prisma.recipe.count({ where: { hotelId, isActive: true } }),
      prisma.posArticle.count({ where: { hotelId, type: "PRODUCT" } }),
      prisma.posArticle.count({ where: { hotelId, type: "RECIPE" } }),
    ]);
  return {
    categories,
    articles,
    activeArticles,
    inactiveArticles: articles - activeArticles,
    recipes,
    productArticles,
    recipeArticles,
  };
}

export async function listPosCategories(user: SessionUser, includeInactive = true) {
  assertSessionHotelId(user);
  return prisma.posCategory.findMany({
    where: {
      hotelId: user.hotelId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { articles: true } } },
  });
}

export async function createPosCategory(user: SessionUser, input: PosCategoryInput) {
  assertSessionHotelId(user);
  const max = await prisma.posCategory.aggregate({
    where: { hotelId: user.hotelId },
    _max: { sortOrder: true },
  });
  const row = await prisma.posCategory.create({
    data: {
      hotelId: user.hotelId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
      isActive: input.isActive ?? true,
    },
  });
  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_category.create",
    entity: "PosCategory",
    entityId: row.id,
    newValue: { name: row.name },
  });
  return row;
}

export async function updatePosCategory(
  user: SessionUser,
  id: string,
  input: PosCategoryInput
) {
  assertSessionHotelId(user);
  const existing = await prisma.posCategory.findFirst({
    where: { id, hotelId: user.hotelId },
  });
  if (!existing) throw new Error("CATEGORY_NOT_FOUND");
  const row = await prisma.posCategory.update({
    where: { id },
    data: {
      name: input.name?.trim() ?? existing.name,
      code: input.code === undefined ? existing.code : input.code?.trim() || null,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      isActive: input.isActive ?? existing.isActive,
    },
  });
  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_category.update",
    entity: "PosCategory",
    entityId: row.id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name: row.name, isActive: row.isActive },
  });
  return row;
}

export async function reorderPosCategories(user: SessionUser, orderedIds: string[]) {
  assertSessionHotelId(user);
  const cats = await prisma.posCategory.findMany({
    where: { hotelId: user.hotelId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (cats.length !== orderedIds.length) throw new Error("CATEGORY_NOT_FOUND");
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.posCategory.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_category.reorder",
    entity: "PosCategory",
    entityId: user.hotelId,
    newValue: { orderedIds },
  });
  return listPosCategories(user);
}

export async function deletePosCategory(user: SessionUser, id: string) {
  assertSessionHotelId(user);
  const existing = await prisma.posCategory.findFirst({
    where: { id, hotelId: user.hotelId },
    include: { _count: { select: { articles: true } } },
  });
  if (!existing) throw new Error("CATEGORY_NOT_FOUND");
  if (existing._count.articles > 0) {
    const row = await prisma.posCategory.update({
      where: { id },
      data: { isActive: false },
    });
    await writeAuditLog({
      hotelId: user.hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "pos_category.deactivate",
      entity: "PosCategory",
      entityId: id,
    });
    return row;
  }
  await prisma.posCategory.delete({ where: { id } });
  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_category.delete",
    entity: "PosCategory",
    entityId: id,
  });
  return { id, deleted: true };
}

export async function listPosArticles(
  user: SessionUser,
  opts: {
    q?: string;
    type?: "PRODUCT" | "RECIPE";
    categoryId?: string;
    active?: boolean;
  } = {}
) {
  assertSessionHotelId(user);
  const needle = opts.q?.trim();
  return prisma.posArticle.findMany({
    where: {
      hotelId: user.hotelId,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.categoryId ? { posCategoryId: opts.categoryId } : {}),
      ...(opts.active === undefined ? {} : { isActive: opts.active }),
      ...(needle
        ? {
            OR: [
              { name: { contains: needle, mode: "insensitive" } },
              { product: { name: { contains: needle, mode: "insensitive" } } },
              { product: { sku: { contains: needle, mode: "insensitive" } } },
              { product: { barcode: { contains: needle, mode: "insensitive" } } },
              { recipe: { name: { contains: needle, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      posCategory: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          purchasePrice: true,
          unit: true,
          isActive: true,
        },
      },
      recipe: {
        include: {
          items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export async function getPosArticle(user: SessionUser, id: string) {
  assertSessionHotelId(user);
  const row = await prisma.posArticle.findFirst({
    where: { id, hotelId: user.hotelId },
    include: {
      posCategory: true,
      product: true,
      recipe: {
        include: {
          items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      priceHistory: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!row) throw new Error("ARTICLE_NOT_FOUND");
  return row;
}

export async function createPosArticleFromProduct(
  user: SessionUser,
  input: PosArticleCreateFromProductInput
) {
  assertSessionHotelId(user);
  const product = await prisma.product.findFirst({
    where: { id: input.productId, hotelId: user.hotelId },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const existing = await prisma.posArticle.findFirst({
    where: { hotelId: user.hotelId, productId: product.id },
  });
  if (existing) throw new Error("ARTICLE_EXISTS");

  if (input.posCategoryId) {
    const cat = await prisma.posCategory.findFirst({
      where: { id: input.posCategoryId, hotelId: user.hotelId },
    });
    if (!cat) throw new Error("CATEGORY_NOT_FOUND");
  }

  const max = await prisma.posArticle.aggregate({
    where: { hotelId: user.hotelId },
    _max: { sortOrder: true },
  });

  const row = await prisma.posArticle.create({
    data: {
      hotelId: user.hotelId,
      type: "PRODUCT",
      productId: product.id,
      posCategoryId: input.posCategoryId ?? null,
      name: input.name?.trim() || product.name,
      description: input.description ?? product.description,
      salePrice: d(input.salePrice ?? product.salePrice.toString()),
      vatRate: d(input.vatRate ?? product.vatRate.toString()),
      imageUrl: input.imageUrl ?? product.imageUrl,
      isFavorite: input.isFavorite ?? product.isFavorite,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
    include: { posCategory: true, product: true },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_article.create",
    entity: "PosArticle",
    entityId: row.id,
    newValue: { type: "PRODUCT", productId: product.id, name: row.name },
  });
  return row;
}

export async function createPosArticleFromRecipe(
  user: SessionUser,
  input: PosArticleCreateFromRecipeInput
) {
  assertSessionHotelId(user);
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, hotelId: user.hotelId, isActive: true },
  });
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  const existing = await prisma.posArticle.findFirst({
    where: { hotelId: user.hotelId, recipeId: recipe.id },
  });
  if (existing) throw new Error("ARTICLE_EXISTS");

  if (input.posCategoryId) {
    const cat = await prisma.posCategory.findFirst({
      where: { id: input.posCategoryId, hotelId: user.hotelId },
    });
    if (!cat) throw new Error("CATEGORY_NOT_FOUND");
  }

  const max = await prisma.posArticle.aggregate({
    where: { hotelId: user.hotelId },
    _max: { sortOrder: true },
  });

  const row = await prisma.posArticle.create({
    data: {
      hotelId: user.hotelId,
      type: "RECIPE",
      recipeId: recipe.id,
      posCategoryId: input.posCategoryId ?? null,
      name: input.name?.trim() || recipe.name,
      description: input.description ?? null,
      salePrice: d(input.salePrice),
      vatRate: d(input.vatRate ?? 8.1),
      imageUrl: input.imageUrl ?? null,
      isFavorite: input.isFavorite ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
    include: {
      posCategory: true,
      recipe: { include: { items: { include: { product: true } } } },
    },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_article.create",
    entity: "PosArticle",
    entityId: row.id,
    newValue: { type: "RECIPE", recipeId: recipe.id, name: row.name },
  });
  return row;
}

export async function updatePosArticle(
  user: SessionUser,
  id: string,
  input: PosArticleUpdateInput
) {
  assertSessionHotelId(user);
  const existing = await prisma.posArticle.findFirst({
    where: { id, hotelId: user.hotelId },
  });
  if (!existing) throw new Error("ARTICLE_NOT_FOUND");

  if (input.posCategoryId) {
    const cat = await prisma.posCategory.findFirst({
      where: { id: input.posCategoryId, hotelId: user.hotelId },
    });
    if (!cat) throw new Error("CATEGORY_NOT_FOUND");
  }

  const priceChanged =
    input.salePrice !== undefined &&
    !d(input.salePrice).eq(existing.salePrice);

  const row = await prisma.$transaction(async (tx) => {
    if (priceChanged) {
      await tx.posPriceHistory.create({
        data: {
          posArticleId: id,
          hotelId: user.hotelId,
          userId: user.id,
          oldPrice: existing.salePrice,
          newPrice: d(input.salePrice!),
        },
      });
    }
    return tx.posArticle.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? existing.name,
        description:
          input.description === undefined
            ? existing.description
            : input.description,
        salePrice:
          input.salePrice === undefined
            ? existing.salePrice
            : d(input.salePrice),
        vatRate:
          input.vatRate === undefined ? existing.vatRate : d(input.vatRate),
        posCategoryId:
          input.posCategoryId === undefined
            ? existing.posCategoryId
            : input.posCategoryId,
        imageUrl:
          input.imageUrl === undefined ? existing.imageUrl : input.imageUrl,
        isFavorite: input.isFavorite ?? existing.isFavorite,
        isActive: input.isActive ?? existing.isActive,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
      include: {
        posCategory: true,
        product: true,
        recipe: { include: { items: { include: { product: true } } } },
      },
    });
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: priceChanged ? "pos_article.price_change" : "pos_article.update",
    entity: "PosArticle",
    entityId: id,
    oldValue: {
      name: existing.name,
      salePrice: existing.salePrice.toString(),
      isActive: existing.isActive,
    },
    newValue: {
      name: row.name,
      salePrice: row.salePrice.toString(),
      isActive: row.isActive,
    },
  });
  return row;
}

export async function reorderPosArticles(user: SessionUser, orderedIds: string[]) {
  assertSessionHotelId(user);
  const rows = await prisma.posArticle.findMany({
    where: { hotelId: user.hotelId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (rows.length !== orderedIds.length) throw new Error("ARTICLE_NOT_FOUND");
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.posArticle.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "pos_article.reorder",
    entity: "PosArticle",
    entityId: user.hotelId,
    newValue: { orderedIds },
  });
  return listPosArticles(user);
}

export async function searchLagerProducts(user: SessionUser, q?: string) {
  assertSessionHotelId(user);
  const needle = q?.trim();
  const products = await prisma.product.findMany({
    where: {
      hotelId: user.hotelId,
      isActive: true,
      ...(needle
        ? {
            OR: [
              { name: { contains: needle, mode: "insensitive" } },
              { sku: { contains: needle, mode: "insensitive" } },
              { barcode: { contains: needle, mode: "insensitive" } },
              { ean: { contains: needle, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: 50,
    orderBy: { name: "asc" },
    include: {
      category: true,
      supplier: { select: { id: true, name: true } },
      posArticles: { select: { id: true, isActive: true } },
    },
  });
  return products.map((p) => ({
    ...p,
    alreadyOnPos: p.posArticles.length > 0,
    salePrice: p.salePrice.toString(),
    purchasePrice: p.purchasePrice.toString(),
    vatRate: p.vatRate.toString(),
  }));
}

export function computeRecipeCost(
  items: {
    quantity: Prisma.Decimal | number | string;
    product: { purchasePrice: Prisma.Decimal | number | string };
  }[]
) {
  let total = d(0);
  for (const item of items) {
    total = total.add(d(item.quantity).mul(d(item.product.purchasePrice)));
  }
  return total;
}
