import { PrismaClient } from "@prisma/client";
import {
  createPurchaseOrder,
  getOrderSuggestions,
  submitPurchaseOrder,
} from "../src/lib/purchasing";
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

  const suggestions = await getOrderSuggestions(user);
  console.log("suggestions", suggestions.length);
  if (!suggestions.length) {
    console.log("VERIFY_PO_OK (no suggestions)");
    return;
  }

  const supplier =
    suggestions.find((s) => s.supplierId)?.supplierId ||
    (
      await prisma.supplier.findFirstOrThrow({
        where: { hotelId: hotel.id },
      })
    ).id;

  const po = await createPurchaseOrder(user, {
    supplierId: supplier,
    items: suggestions.slice(0, 3).map((s) => ({
      productId: s.productId,
      quantityOrdered: s.suggestedQty,
      unitPrice: s.purchasePrice,
    })),
  });
  console.log("draft", po.status, po.items.length);

  const ordered = await submitPurchaseOrder(user, po.id);
  console.log("ordered", ordered.status, ordered.orderedAt);
  console.log("VERIFY_PO_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
