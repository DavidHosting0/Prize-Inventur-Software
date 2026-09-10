import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hotels = await prisma.hotel.findMany({ include: { warehouses: true } });
  for (const hotel of hotels) {
    const active = hotel.warehouses.filter((w) => w.isActive);
    console.log(
      hotel.name,
      "active=",
      active.map((w) => `${w.code}:${w.name}`).join(",") || "(none)",
      "inactive=",
      hotel.warehouses.length - active.length
    );
    const levels = await prisma.stockLevel.groupBy({
      by: ["productId"],
      where: { warehouse: { hotelId: hotel.id } },
      _count: true,
    });
    const multi = levels.filter((l) => l._count > 1);
    console.log("  products with multi stock rows:", multi.length);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
