/**
 * Verify breakfast upsert + forecast and minibar stock reduction (no folio).
 */
import { PrismaClient } from "@prisma/client";
import { upsertBreakfastRecord, getBreakfastForecast } from "../src/lib/breakfast";
import { recordMinibarConsumption } from "../src/lib/minibar";
import type { SessionUser } from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  const userRow = await prisma.user.findFirst({
    where: { email: "admin@demo-hotel.ch" },
    include: {
      hotels: true,
      role: true,
    },
  });
  if (!userRow || !userRow.hotels[0]) throw new Error("No admin user");

  const hotelLink = userRow.hotels[0];
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelLink.hotelId } });
  const hotelId = hotel.id;
  const user: SessionUser = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    username: userRow.username,
    roleCode: userRow.role.code,
    accountType: "HOTEL",
    organizationId: hotel.organizationId,
    hotelId,
    permissions: [],
    locale: "de",
    currency: "CHF",
    hotelLocale: "de-CH",
    hotelName: "Demo",
  };

  const date = new Date().toISOString().slice(0, 10);
  const breakfast = await upsertBreakfastRecord(user, {
    date,
    expectedGuests: 120,
    actualGuests: 110,
    costTotal: 880,
    notes: "verify",
  });
  if (breakfast.actualGuests !== 110) throw new Error("Breakfast upsert failed");

  const forecast = await getBreakfastForecast(user);
  if (!forecast.expectedTomorrow) throw new Error("Forecast empty");

  const product =
    (await prisma.product.findFirst({
      where: { hotelId, category: { code: "MINIBAR" }, isActive: true },
    })) ||
    (await prisma.product.findFirst({ where: { hotelId, isActive: true } }));
  if (!product) throw new Error("No product");

  const warehouse = await prisma.warehouse.findFirst({
    where: { hotelId, code: "LAGER", isActive: true },
  });
  if (!warehouse) throw new Error("No LAGER warehouse");

  await prisma.stockLevel.upsert({
    where: {
      productId_warehouseId: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
    create: {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 20,
    },
    update: { quantity: 20 },
  });

  const before = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
  });

  const record = await recordMinibarConsumption(user, {
    roomNumber: "999",
    productId: product.id,
    quantity: 2,
    notes: "verify no folio",
  });

  const after = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
  });

  if (Number(after.quantity) !== Number(before.quantity) - 2) {
    throw new Error(
      `Stock not reduced: before=${before.quantity} after=${after.quantity}`
    );
  }

  // Ensure no Sale / Payment linked as room charge
  const salesWithRoom = await prisma.sale.count({
    where: { hotelId, roomReference: "999", createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (salesWithRoom > 0) throw new Error("Unexpected room-charge sale created");

  console.log("OK breakfast", breakfast.id, "forecast", forecast.expectedTomorrow);
  console.log("OK minibar", record.id, "stock", String(after.quantity));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
