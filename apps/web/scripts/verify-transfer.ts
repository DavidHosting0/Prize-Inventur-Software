import { PrismaClient } from "@prisma/client";
import { createStockTransfer } from "../src/lib/transfers";
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

  let threw = false;
  try {
    await createStockTransfer(user, {
      fromWarehouseId: lager.id,
      toWarehouseId: lager.id,
      reason: "Verify transfers disabled",
      items: [{ productId: coke.id, quantity: 5 }],
    });
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== "TRANSFERS_DISABLED") {
      throw new Error(`expected TRANSFERS_DISABLED, got ${msg}`);
    }
  }
  if (!threw) throw new Error("createStockTransfer should throw TRANSFERS_DISABLED");

  console.log("VERIFY_TRANSFER_DISABLED_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
