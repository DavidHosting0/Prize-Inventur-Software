import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import { hasPermission, type SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import type { CreateSaleInput, PaySaleInput } from "@prize/validators";
import type { SaleDiscountType, VoucherCode } from "@prize/types";
import { getCentralWarehouse } from "@/lib/warehouse";
import {
  productSaleQtyToStockUnits,
  recipeQtyToStockUnits,
} from "@/lib/liquid-stock";

function d(n: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(n);
}

function voucherDiscountType(code: VoucherCode | null | undefined): SaleDiscountType {
  if (code === "CLUB") return "VOUCHER_CLUB";
  if (code === "PREMIUM") return "VOUCHER_PREMIUM";
  if (code === "VIP") return "VOUCHER_VIP";
  return "NONE";
}

function saleNeedsDiscountPermission(input: CreateSaleInput): boolean {
  const orderPct = input.discountPercent ?? 0;
  const orderAmt = input.discountAmount ?? 0;
  if (orderPct > 0 || orderAmt > 0) return true;
  if (input.voucherCode) return true;
  if (input.discountType && input.discountType !== "NONE") return true;
  return input.items.some(
    (i) =>
      (i.discountPercent ?? 0) > 0 ||
      i.isComplimentary === true ||
      (i.unitPrice !== undefined && i.unitPrice === 0)
  );
}

async function nextTransactionNo(
  tx: Prisma.TransactionClient,
  hotelId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sale-txno-${hotelId}`}))`;
  const year = new Date().getFullYear();
  const prefix = `TX-${year}-`;
  const last = await tx.sale.findFirst({
    where: { hotelId, transactionNo: { startsWith: prefix } },
    orderBy: { transactionNo: "desc" },
    select: { transactionNo: true },
  });
  let seq = 1;
  if (last?.transactionNo) {
    const n = Number(last.transactionNo.slice(prefix.length));
    if (Number.isFinite(n) && n >= 0) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

type ResolvedLine = {
  productId: string | null;
  posArticleId: string | null;
  recipeId: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  nameSnapshot: string;
  isComplimentary: boolean;
};

export async function createPendingSale(user: SessionUser, input: CreateSaleInput) {
  assertSessionHotelId(user);
  const warehouse = await getCentralWarehouse(user.hotelId);
  void input.warehouseId;

  if (input.cashRegisterId) {
    const register = await prisma.cashRegister.findFirst({
      where: { id: input.cashRegisterId, hotelId: user.hotelId },
    });
    if (!register) throw new Error("REGISTER_NOT_FOUND");
  }

  if (saleNeedsDiscountPermission(input)) {
    if (!hasPermission(user, "pos.discount") && user.roleCode !== "ADMIN") {
      throw new Error("DISCOUNT_FORBIDDEN");
    }
  }

  const articleIds = input.items
    .map((i) => i.posArticleId)
    .filter((id): id is string => Boolean(id));
  const productIds = input.items
    .map((i) => i.productId)
    .filter((id): id is string => Boolean(id));

  const [articles, products] = await Promise.all([
    articleIds.length
      ? prisma.posArticle.findMany({
          where: {
            hotelId: user.hotelId,
            id: { in: articleIds },
            isActive: true,
          },
          include: {
            product: true,
            recipe: { include: { items: true } },
          },
        })
      : Promise.resolve([]),
    productIds.length
      ? prisma.product.findMany({
          where: {
            hotelId: user.hotelId,
            id: { in: productIds },
            isActive: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = d(0);
  let taxAmount = d(0);
  let anyComplimentary = false;

  const lineItems: ResolvedLine[] = input.items.map((item) => {
    const isComplimentary = item.isComplimentary === true;
    let discountPercent = d(item.discountPercent ?? 0);
    if (isComplimentary) {
      anyComplimentary = true;
      discountPercent = d(100);
    }

    if (item.posArticleId) {
      const article = articleMap.get(item.posArticleId);
      if (!article) throw new Error("POS_ARTICLE_NOT_FOUND_OR_INACTIVE");
      if (article.type === "PRODUCT") {
        if (!article.productId || !article.product?.isActive) {
          throw new Error("PRODUCT_NOT_FOUND_OR_INACTIVE");
        }
      } else if (article.type === "RECIPE") {
        if (!article.recipeId || !article.recipe?.isActive) {
          throw new Error("RECIPE_NOT_FOUND_OR_INACTIVE");
        }
      }

      const unitPrice = d(item.unitPrice ?? article.salePrice.toString());
      const qty = d(item.quantity);
      const gross = unitPrice.mul(qty);
      const discount = gross.mul(discountPercent).div(100);
      const net = gross.sub(discount);
      const vat = article.vatRate;
      const taxPortion = net.eq(0)
        ? d(0)
        : net.sub(net.div(d(1).add(vat.div(100))));
      subtotal = subtotal.add(net);
      taxAmount = taxAmount.add(taxPortion);

      return {
        productId: article.type === "PRODUCT" ? article.productId : null,
        posArticleId: article.id,
        recipeId: article.type === "RECIPE" ? article.recipeId : null,
        quantity: qty,
        unitPrice,
        discountPercent,
        vatRate: vat,
        lineTotal: net,
        nameSnapshot: article.name,
        isComplimentary,
      };
    }

    const product = productMap.get(item.productId!);
    if (!product) throw new Error("PRODUCT_NOT_FOUND_OR_INACTIVE");
    const unitPrice = d(item.unitPrice ?? product.salePrice.toString());
    const qty = d(item.quantity);
    const gross = unitPrice.mul(qty);
    const discount = gross.mul(discountPercent).div(100);
    const net = gross.sub(discount);
    const taxPortion = net.eq(0)
      ? d(0)
      : net.sub(net.div(d(1).add(product.vatRate.div(100))));
    subtotal = subtotal.add(net);
    taxAmount = taxAmount.add(taxPortion);
    return {
      productId: product.id,
      posArticleId: null,
      recipeId: null,
      quantity: qty,
      unitPrice,
      discountPercent,
      vatRate: product.vatRate,
      lineTotal: net,
      nameSnapshot: product.name,
      isComplimentary,
    };
  });

  let discountAmount = d(0);
  let orderDiscountPct = d(input.discountPercent ?? 0);

  if (input.discountAmount != null && input.discountAmount > 0) {
    discountAmount = Prisma.Decimal.min(d(input.discountAmount), subtotal);
    orderDiscountPct = subtotal.gt(0)
      ? discountAmount.mul(100).div(subtotal)
      : d(0);
  } else if (orderDiscountPct.gt(0)) {
    discountAmount = subtotal.mul(orderDiscountPct).div(100);
  }

  const total = subtotal.sub(discountAmount);
  if (orderDiscountPct.gt(0)) {
    taxAmount = taxAmount.mul(d(1).sub(orderDiscountPct.div(100)));
  }

  let discountType: SaleDiscountType =
    (input.discountType as SaleDiscountType | undefined) ?? "NONE";
  if (discountType === "NONE") {
    if (input.voucherCode) {
      discountType = voucherDiscountType(input.voucherCode);
    } else if (anyComplimentary && total.eq(0)) {
      discountType = "FREE_ITEM";
    } else if (discountAmount.gt(0) || anyComplimentary) {
      discountType = anyComplimentary ? "FREE_ITEM" : "MANUAL";
    }
  }

  return prisma.$transaction(async (tx) => {
    const transactionNo = await nextTransactionNo(tx, user.hotelId);

    let cashRegisterId = input.cashRegisterId;
    let cashSessionId: string | undefined;

    if (!cashRegisterId) {
      const register = await tx.cashRegister.findFirst({
        where: { hotelId: user.hotelId, isActive: true },
      });
      cashRegisterId = register?.id;
    }

    if (cashRegisterId) {
      let session = await tx.cashSession.findFirst({
        where: { cashRegisterId, status: "OPEN" },
      });
      if (!session) {
        session = await tx.cashSession.create({
          data: {
            cashRegisterId,
            openedById: user.id,
            status: "OPEN",
          },
        });
      }
      cashSessionId = session.id;
    }

    const sale = await tx.sale.create({
      data: {
        hotelId: user.hotelId,
        warehouseId: warehouse.id,
        cashierId: user.id,
        cashRegisterId,
        cashSessionId,
        status: "PENDING",
        subtotal,
        discountAmount,
        taxAmount,
        total,
        currency: user.currency,
        discountType,
        discountReason: input.discountReason ?? null,
        voucherCode: input.voucherCode ?? null,
        roomReference: input.roomReference ?? null,
        guestName: input.guestName ?? null,
        notes: input.notes ?? null,
        transactionNo,
        items: { create: lineItems },
      },
      include: { items: true, payments: true },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "sale.create",
        entity: "Sale",
        entityId: sale.id,
        newValue: {
          transactionNo,
          total: total.toString(),
          status: "PENDING",
          discountType,
          voucherCode: input.voucherCode ?? null,
          discountReason: input.discountReason ?? null,
        },
      },
    });

    return sale;
  });
}

async function applySaleStock(
  tx: Prisma.TransactionClient,
  user: SessionUser & { hotelId: string },
  saleId: string,
  items: {
    productId: string | null;
    recipeId: string | null;
    quantity: Prisma.Decimal;
    isComplimentary: boolean;
  }[],
  direction: "SALE" | "RETURN",
  reason: string
) {
  const warehouse = await getCentralWarehouse(user.hotelId, tx);
  const sign = direction === "SALE" ? -1 : 1;

  for (const item of items) {
    if (item.recipeId) {
      const recipe = await tx.recipe.findFirst({
        where: { id: item.recipeId, hotelId: user.hotelId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  trackLiquid: true,
                  bottleContentMl: true,
                },
              },
            },
          },
        },
      });
      if (!recipe) throw new Error("RECIPE_NOT_FOUND");
      for (const ing of recipe.items) {
        const deltaQty = recipeQtyToStockUnits(
          ing.product,
          ing.quantity,
          ing.unit
        ).mul(item.quantity);
        await applyStockChange(tx, {
          hotelId: user.hotelId,
          productId: ing.productId,
          warehouseId: warehouse.id,
          userId: user.id,
          delta: deltaQty.mul(sign),
          type: direction === "SALE" ? "SALE" : "RETURN",
          reason: `${reason} (Rezept)`,
          referenceType: "Sale",
          referenceId: saleId,
        });
      }
      continue;
    }

    if (!item.productId) throw new Error("PRODUCT_REQUIRED");
    const product = await tx.product.findFirst({
      where: { id: item.productId, hotelId: user.hotelId },
      select: { trackLiquid: true, bottleContentMl: true },
    });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const deltaQty = productSaleQtyToStockUnits(product, item.quantity);
    await applyStockChange(tx, {
      hotelId: user.hotelId,
      productId: item.productId,
      warehouseId: warehouse.id,
      userId: user.id,
      delta: deltaQty.mul(sign),
      type: direction === "SALE" ? "SALE" : "RETURN",
      reason,
      referenceType: "Sale",
      referenceId: saleId,
    });
  }
}

export async function paySale(
  user: SessionUser,
  saleId: string,
  input: PaySaleInput
) {
  assertSessionHotelId(user);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.sale.updateMany({
      where: { id: saleId, hotelId: user.hotelId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) {
      const existing = await tx.sale.findFirst({
        where: { id: saleId, hotelId: user.hotelId },
      });
      if (!existing) throw new Error("SALE_NOT_FOUND");
      throw new Error("SALE_NOT_PAYABLE");
    }

    const sale = await tx.sale.findFirstOrThrow({
      where: { id: saleId, hotelId: user.hotelId },
      include: { items: true },
    });

    const payAmount = d(input.amount ?? sale.total.toString());
    if (sale.total.gt(0) && payAmount.lt(sale.total)) {
      throw new Error("PAYMENT_INSUFFICIENT");
    }
    if (sale.total.eq(0) && payAmount.lt(0)) {
      throw new Error("PAYMENT_INSUFFICIENT");
    }

    const reference =
      input.reference ??
      (input.method === "OFFLINE"
        ? input.notes?.trim() || "Offline verrechenbar"
        : null);

    if (input.notes?.trim()) {
      const noteLine = input.notes.trim();
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          notes: sale.notes ? `${sale.notes}\n${noteLine}` : noteLine,
        },
      });
    }

    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: input.method,
        amount: sale.total.eq(0) ? d(0) : payAmount,
        currency: sale.currency,
        reference,
        status: "COMPLETED",
      },
    });

    await applySaleStock(
      tx,
      user,
      sale.id,
      sale.items,
      "SALE",
      sale.items.some((i) => i.isComplimentary) ? "POS Free / Comp" : "POS Verkauf"
    );

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "sale.pay",
        entity: "Sale",
        entityId: sale.id,
        oldValue: { status: "PENDING" },
        newValue: {
          status: "PAID",
          method: input.method,
          reference,
        },
      },
    });

    return tx.sale.findFirstOrThrow({
      where: { id: sale.id },
      include: {
        items: { include: { product: true, posArticle: true } },
        payments: true,
        cashier: true,
        warehouse: true,
      },
    });
  });
}

export async function cancelSale(user: SessionUser, saleId: string) {
  assertSessionHotelId(user);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.sale.updateMany({
      where: { id: saleId, hotelId: user.hotelId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) {
      const existing = await tx.sale.findFirst({
        where: { id: saleId, hotelId: user.hotelId },
      });
      if (!existing) throw new Error("SALE_NOT_FOUND");
      throw new Error("SALE_NOT_CANCELLABLE");
    }

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "sale.cancel",
        entity: "Sale",
        entityId: saleId,
        oldValue: { status: "PENDING" },
        newValue: { status: "CANCELLED" },
      },
    });

    return tx.sale.findFirstOrThrow({ where: { id: saleId } });
  });
}

export async function refundSale(
  user: SessionUser,
  saleId: string,
  reason?: string
) {
  assertSessionHotelId(user);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.sale.updateMany({
      where: { id: saleId, hotelId: user.hotelId, status: "PAID" },
      data: { status: "REFUNDED" },
    });
    if (claimed.count === 0) {
      const existing = await tx.sale.findFirst({
        where: { id: saleId, hotelId: user.hotelId },
      });
      if (!existing) throw new Error("SALE_NOT_FOUND");
      throw new Error("SALE_NOT_REFUNDABLE");
    }

    const sale = await tx.sale.findFirstOrThrow({
      where: { id: saleId, hotelId: user.hotelId },
      include: { items: true },
    });

    await applySaleStock(
      tx,
      user,
      sale.id,
      sale.items,
      "RETURN",
      reason ?? "Rueckerstattung"
    );

    await tx.refund.create({
      data: {
        saleId: sale.id,
        userId: user.id,
        amount: sale.total,
        reason: reason ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "sale.refund",
        entity: "Sale",
        entityId: sale.id,
        oldValue: { status: "PAID" },
        newValue: { status: "REFUNDED", reason },
      },
    });

    return tx.sale.findFirstOrThrow({
      where: { id: sale.id },
      include: { items: true, payments: true, refunds: true },
    });
  });
}
