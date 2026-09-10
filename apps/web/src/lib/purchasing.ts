import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAuditLog } from "./audit";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";

export async function createPurchaseOrder(
  user: SessionUser,
  input: {
    supplierId: string;
    items: { productId: string; quantityOrdered: number; unitPrice: number }[];
  }
) {
  assertSessionHotelId(user);
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, hotelId: user.hotelId },
  });
  if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");
  if (!input.items.length) throw new Error("NO_ITEMS");

  const po = await prisma.purchaseOrder.create({
    data: {
      hotelId: user.hotelId,
      supplierId: input.supplierId,
      status: "DRAFT",
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          quantityOrdered: new Prisma.Decimal(i.quantityOrdered),
          unitPrice: new Prisma.Decimal(i.unitPrice),
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      supplier: true,
    },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "purchaseOrder.create",
    entity: "PurchaseOrder",
    entityId: po.id,
    newValue: { status: "DRAFT", items: po.items.length },
  });

  return po;
}

export async function submitPurchaseOrder(user: SessionUser, id: string) {
  assertSessionHotelId(user);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, hotelId: user.hotelId },
  });
  if (!po) throw new Error("PO_NOT_FOUND");
  if (po.status !== "DRAFT") throw new Error("PO_NOT_DRAFT");

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "ORDERED", orderedAt: new Date() },
    include: { items: { include: { product: true } }, supplier: true },
  });

  await writeAuditLog({
    hotelId: user.hotelId,
    organizationId: user.organizationId,
    accountType: user.accountType,
    userId: user.id,
    action: "purchaseOrder.submit",
    entity: "PurchaseOrder",
    entityId: id,
    oldValue: { status: "DRAFT" },
    newValue: { status: "ORDERED" },
  });

  return updated;
}

/** Suggest order qty from min/optimal stock vs central Lager levels. */
export async function getOrderSuggestions(user: SessionUser) {
  assertSessionHotelId(user);
  const stocks = await prisma.stockLevel.findMany({
    where: { warehouse: { hotelId: user.hotelId, isActive: true } },
    include: { product: true },
  });

  // One stock row per product on central Lager; aggregate defensively if legacy rows remain
  const byProduct = new Map<
    string,
    { product: (typeof stocks)[0]["product"]; qty: number }
  >();
  for (const s of stocks) {
    const cur = byProduct.get(s.productId);
    const qty = Number(s.quantity);
    if (!cur) byProduct.set(s.productId, { product: s.product, qty });
    else cur.qty += qty;
  }

  const suggestions = [];
  for (const { product, qty } of byProduct.values()) {
    const min = Number(product.minStock);
    const optimal = Number(product.optimalStock);
    if (qty >= min) continue;
    const recommend = Math.max(optimal - qty, min - qty, 0);
    if (recommend <= 0) continue;
    suggestions.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: qty,
      minStock: min,
      optimalStock: optimal,
      suggestedQty: Math.ceil(recommend),
      purchasePrice: Number(product.purchasePrice),
      supplierId: product.supplierId,
    });
  }

  return suggestions.sort((a, b) => a.currentStock / a.minStock - b.currentStock / b.minStock);
}
