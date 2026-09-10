import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  DEFAULT_COMPLIMENTARY_REASONS,
  DEFAULT_VOUCHER_PRESETS,
  type VoucherPreset,
  type VoucherCode,
} from "@prize/types";

export type PosProduct = {
  id: string;
  posArticleId: string;
  type: "PRODUCT" | "RECIPE";
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: string;
  vatRate: string;
  categoryId: string;
  isFavorite: boolean;
  isActive: boolean;
  imageUrl: string | null;
  productId: string | null;
  recipeId: string | null;
  /** Preparation steps for RECIPE articles; null for products / empty recipes. */
  instructions: string | null;
};

export type PosCategory = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type PosWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type PosBootstrap = {
  categories: PosCategory[];
  products: PosProduct[];
  warehouses: PosWarehouse[];
  vouchers: VoucherPreset[];
  complimentaryReasons: string[];
  permissions: {
    canDiscount: boolean;
    canCreateProduct: boolean;
  };
};

function parseVouchers(posSettings: unknown): VoucherPreset[] {
  if (
    posSettings &&
    typeof posSettings === "object" &&
    "vouchers" in posSettings &&
    Array.isArray((posSettings as { vouchers: unknown }).vouchers)
  ) {
    const rows = (posSettings as { vouchers: unknown[] }).vouchers
      .map((v) => {
        if (!v || typeof v !== "object") return null;
        const row = v as Record<string, unknown>;
        const code = String(row.code ?? "").toUpperCase();
        if (code !== "CLUB" && code !== "PREMIUM" && code !== "VIP") return null;
        const discountPercent = Number(row.discountPercent);
        if (!Number.isFinite(discountPercent) || discountPercent < 0) return null;
        return {
          code: code as VoucherCode,
          name: String(row.name ?? code),
          discountPercent,
        };
      })
      .filter((v): v is VoucherPreset => v !== null);
    if (rows.length > 0) return rows;
  }
  return [...DEFAULT_VOUCHER_PRESETS];
}

export function parseComplimentaryReasons(posSettings: unknown): string[] {
  if (
    posSettings &&
    typeof posSettings === "object" &&
    "complimentaryReasons" in posSettings
  ) {
    const raw = (posSettings as { complimentaryReasons: unknown })
      .complimentaryReasons;
    if (Array.isArray(raw)) {
      return raw
        .map((r) => String(r ?? "").trim())
        .filter((r) => r.length > 0)
        .slice(0, 40);
    }
  }
  return [...DEFAULT_COMPLIMENTARY_REASONS];
}

/** POS bootstrap from PosArticle / PosCategory configuration. */
export const loadPosBootstrap = cache(
  async (
    hotelId: string,
    opts?: { canDiscount?: boolean; canCreateProduct?: boolean }
  ): Promise<PosBootstrap> => {
    const [categories, articles, warehouses, hotel] = await Promise.all([
      prisma.posCategory.findMany({
        where: { hotelId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, code: true, name: true, sortOrder: true },
      }),
      prisma.posArticle.findMany({
        where: { hotelId, isActive: true },
        orderBy: [{ isFavorite: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        include: {
          product: {
            select: { sku: true, barcode: true, isActive: true },
          },
          recipe: {
            select: { instructions: true },
          },
        },
      }),
      prisma.warehouse.findMany({
        where: { hotelId, isActive: true, code: "LAGER" },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.hotel.findFirst({
        where: { id: hotelId },
        select: { posSettings: true },
      }),
    ]);

    const resolvedWarehouses =
      warehouses.length > 0
        ? warehouses
        : await prisma.warehouse.findMany({
            where: { hotelId, isActive: true },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { id: true, code: true, name: true },
          });

    const products: PosProduct[] = articles
      .filter((a) => {
        if (a.type === "PRODUCT") {
          return Boolean(a.productId && a.product?.isActive !== false);
        }
        return Boolean(a.recipeId);
      })
      .map((a) => ({
        id: a.id,
        posArticleId: a.id,
        type: a.type,
        name: a.name,
        sku: a.product?.sku ?? null,
        barcode: a.product?.barcode ?? null,
        salePrice: a.salePrice.toString(),
        vatRate: a.vatRate.toString(),
        categoryId: a.posCategoryId ?? "",
        isFavorite: a.isFavorite,
        isActive: a.isActive,
        imageUrl: a.imageUrl,
        productId: a.productId,
        recipeId: a.recipeId,
        instructions:
          a.type === "RECIPE" && a.recipe?.instructions?.trim()
            ? a.recipe.instructions.trim()
            : null,
      }));

    return {
      categories: categories.map((c) => ({
        id: c.id,
        code: c.code ?? c.name,
        name: c.name,
        sortOrder: c.sortOrder,
      })),
      products,
      warehouses: resolvedWarehouses,
      vouchers: parseVouchers(hotel?.posSettings),
      complimentaryReasons: parseComplimentaryReasons(hotel?.posSettings),
      permissions: {
        canDiscount: opts?.canDiscount ?? false,
        canCreateProduct: opts?.canCreateProduct ?? false,
      },
    };
  }
);

/** Resolve barcode → active PRODUCT PosArticle for this hotel. */
export async function resolvePosArticleByBarcode(
  hotelId: string,
  code: string
) {
  const product = await prisma.product.findFirst({
    where: {
      hotelId,
      isActive: true,
      OR: [{ barcode: code }, { ean: code }, { sku: code }],
    },
  });
  if (!product) return null;
  const article = await prisma.posArticle.findFirst({
    where: {
      hotelId,
      productId: product.id,
      type: "PRODUCT",
      isActive: true,
    },
  });
  if (!article) return null;
  return {
    id: article.id,
    posArticleId: article.id,
    type: "PRODUCT" as const,
    name: article.name,
    sku: product.sku,
    barcode: product.barcode,
    salePrice: article.salePrice.toString(),
    vatRate: article.vatRate.toString(),
    categoryId: article.posCategoryId ?? "",
    isFavorite: article.isFavorite,
    isActive: article.isActive,
    imageUrl: article.imageUrl,
    productId: product.id,
    recipeId: null,
  };
}
