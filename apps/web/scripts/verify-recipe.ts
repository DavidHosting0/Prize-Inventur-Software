import { PrismaClient } from "@prisma/client";
import { createRecipe, theoreticalConsumption, versionRecipe } from "../src/lib/recipes";
import type { SessionUser } from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  const userRow = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@demo-hotel.ch" },
    include: {
      role: true,
      hotels: { include: { hotel: true }, take: 1 },
    },
  });
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

  const bun = await prisma.product.findFirstOrThrow({
    where: { sku: "BF-BREADROLL" },
  });
  const butter = await prisma.product.findFirstOrThrow({
    where: { sku: "BF-BUTTER" },
  });

  const recipe = await createRecipe(user, {
    name: "Butterbroetchen",
    items: [
      { productId: bun.id, quantity: 1, unit: "PIECE" },
      { productId: butter.id, quantity: 0.02, unit: "KG" },
    ],
  });
  console.log("recipe v", recipe.version, recipe.items.length);

  const theory = await theoreticalConsumption(hotel.id, recipe.id, 10);
  console.log(
    "theory10",
    theory.map((t) => `${t.quantity} ${t.unit} ${t.name}`).join(", ")
  );

  const v2 = await versionRecipe(user, recipe.id, {
    items: [
      { productId: bun.id, quantity: 1, unit: "PIECE" },
      { productId: butter.id, quantity: 0.025, unit: "KG" },
    ],
  });
  console.log("versioned", v2.version, "oldActive?", !(await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })).isActive);
  console.log("VERIFY_RECIPE_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
