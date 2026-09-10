import { PrismaClient } from "@prisma/client";
import {
  confirmGoodsReceipt,
  createGoodsReceipt,
} from "../src/lib/goods-receipts";
import type { SessionUser } from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  const userRow = await prisma.user.findUnique({
    where: { email: "admin@demo-hotel.ch" },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      hotels: { include: { hotel: true }, take: 1 },
    },
  });
  if (!userRow) throw new Error("no user");
  const hotel = userRow.hotels[0]!.hotel;
  const user: SessionUser = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    username: userRow.username,
    roleCode: userRow.role.code,
    accountType: "HOTEL",
    organizationId: hotel.organizationId,
    hotelId: hotel.id,
    permissions: userRow.role.permissions.map(
      (p) => p.permission.code as SessionUser["permissions"][number]
    ),
    locale: userRow.locale,
    currency: hotel.currency,
    hotelLocale: hotel.locale,
    hotelName: hotel.name,
  };

  const coke = await prisma.product.findFirstOrThrow({
    where: { sku: "BEV-COKE-033" },
  });
  const lager = await prisma.warehouse.findFirstOrThrow({
    where: { code: "LAGER", hotelId: hotel.id },
  });
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { hotelId: hotel.id },
  });

  const before = await prisma.stockLevel.findUnique({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  const beforeQty = before?.quantity ?? new (await import("@prisma/client")).Prisma.Decimal(0);

  const draft = await createGoodsReceipt(user, {
    supplierId: supplier.id,
    deliveryNoteNo: "DN-VERIFY-001",
    items: [
      {
        productId: coke.id,
        qtyOrdered: 100,
        qtyDelivered: 96,
        qtyDamaged: 2,
        qtyMissing: 4,
        purchasePrice: 0.85,
      },
    ],
  });
  console.log("draft", draft.status);

  const mid = await prisma.stockLevel.findUnique({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  console.log(
    "stockUnchangedWhileDraft?",
    (mid?.quantity ?? beforeQty).equals(beforeQty)
  );

  const confirmed = await confirmGoodsReceipt(user, draft.id);
  console.log("confirmed", confirmed.status);

  // stock should increase by delivered - damaged = 94
  const after = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  const expected = beforeQty.add(94);
  console.log("stockAfter", after.quantity.toString(), "expected", expected.toString());
  if (!after.quantity.equals(expected)) throw new Error("STOCK_MISMATCH");

  const again = await confirmGoodsReceipt(user, draft.id);
  if (again.status !== "CONFIRMED" || again.id !== draft.id) {
    throw new Error("idempotent confirm should return existing CONFIRMED receipt");
  }
  const afterAgain = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  if (!afterAgain.quantity.equals(after.quantity)) {
    throw new Error("second confirm must not change stock");
  }
  const purchaseMoves = await prisma.inventoryMovement.count({
    where: { referenceId: draft.id, type: "PURCHASE" },
  });
  if (purchaseMoves !== 1) throw new Error("expected exactly one PURCHASE movement");
  console.log("idempotentConfirm OK");

  const movement = await prisma.inventoryMovement.findFirst({
    where: { referenceId: draft.id, type: "PURCHASE" },
  });
  console.log("movement", movement?.quantity.toString());
  console.log("VERIFY_GOODS_RECEIPT_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
