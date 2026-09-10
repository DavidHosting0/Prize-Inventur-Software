import { PrismaClient } from "@prisma/client";
import { recordWaste } from "../src/lib/waste";
import type { SessionUser } from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  const userRow = await prisma.user.findUnique({
    where: { email: "admin@demo-hotel.ch" },
    include: {
      role: true,
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
    permissions: [],
    locale: "de",
    currency: hotel.currency,
    hotelLocale: hotel.locale,
    hotelName: hotel.name,
  };

  const milk = await prisma.product.findFirstOrThrow({
    where: { sku: "BF-MILK" },
  });
  const lager = await prisma.warehouse.findFirstOrThrow({
    where: { code: "LAGER", hotelId: hotel.id },
  });
  const before = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: milk.id, warehouseId: lager.id },
    },
  });

  const waste = await recordWaste(user, {
    productId: milk.id,
    quantity: 1,
    reason: "EXPIRED",
  });

  const after = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: milk.id, warehouseId: lager.id },
    },
  });

  console.log(
    "wasteCost",
    waste.costValue.toString(),
    "stock",
    before.quantity.toString(),
    "->",
    after.quantity.toString()
  );
  if (!after.quantity.equals(before.quantity.sub(1))) throw new Error("STOCK");
  console.log("VERIFY_WASTE_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
