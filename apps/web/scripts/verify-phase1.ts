import { PrismaClient } from "@prisma/client";
import { createPendingSale, paySale } from "../src/lib/sales";
import {
  closeInventoryCount,
  countInventoryItem,
  createInventoryCount,
} from "../src/lib/inventory";
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
  const before = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });

  const pending = await createPendingSale(user, {
    items: [{ productId: coke.id, quantity: 2 }],
  });
  console.log("pending", pending.status, pending.transactionNo);

  const afterPending = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  console.log(
    "stockAfterPending unchanged?",
    afterPending.quantity.equals(before.quantity)
  );

  const paid = await paySale(user, pending.id, { method: "CASH" });
  console.log("paid", paid.status);

  const afterPaid = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  console.log(
    "stockAfterPaid",
    afterPaid.quantity.toString(),
    "expected",
    before.quantity.sub(2).toString()
  );

  const movement = await prisma.inventoryMovement.findFirst({
    where: { referenceId: paid.id, type: "SALE" },
    orderBy: { createdAt: "desc" },
  });
  console.log("movement", movement?.quantity.toString(), movement?.reason);

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: paid.id, action: "sale.pay" },
  });
  console.log("audit", !!audit);

  const count = await createInventoryCount(user, {
    name: "Verify Count",
    productIds: [coke.id],
  });
  const sys = Number(count.items[0]!.systemQty);
  await countInventoryItem(user, count.id, coke.id, sys - 1);
  await closeInventoryCount(user, count.id);
  const afterInv = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: coke.id, warehouseId: lager.id },
    },
  });
  console.log(
    "stockAfterInventory",
    afterInv.quantity.toString(),
    "expected",
    afterPaid.quantity.sub(1).toString()
  );
  console.log("VERIFY_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
