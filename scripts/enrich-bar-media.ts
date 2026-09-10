/**
 * Enrich demo hotel with product images, bar spirits, and cocktail recipes.
 * Idempotent — safe to re-run. Does not wipe existing data.
 *
 * Usage: pnpm --filter @prize/web exec tsx ../../scripts/enrich-bar-media.ts
 * (or from apps/web: pnpm exec tsx ../../scripts/enrich-bar-media.ts)
 */
import { PrismaClient, type Unit } from "@prisma/client";

const prisma = new PrismaClient();

const IMG = (file: string) => `/seed-images/${file}`;

const PRODUCT_IMAGES: Record<string, string> = {
  "BEV-COKE-033": IMG("coke.jpg"),
  "BEV-COKEZ-033": IMG("coke-zero.jpg"),
  "BEV-SPRITE-033": IMG("sprite.jpg"),
  "BEV-WATER-05": IMG("water.jpg"),
  "BAR-BEER-033": IMG("beer.jpg"),
  "BF-COFFEE": IMG("coffee.jpg"),
  "BF-MILK": IMG("milk.jpg"),
  "BF-EGGS": IMG("eggs.jpg"),
  "BF-CROISSANT": IMG("croissant.jpg"),
  "BF-BREADROLL": IMG("bread.jpg"),
  "BF-BUTTER": IMG("butter.jpg"),
  "BEV-OJ": IMG("orange-juice.jpg"),
  "MB-WATER-05": IMG("water.jpg"),
  "MB-CHOC": IMG("chocolate.jpg"),
  "MB-SOFT": IMG("soft-drink.jpg"),
};

type SpiritSeed = {
  name: string;
  sku: string;
  barcode: string;
  categoryCode: string;
  purchasePrice: number;
  salePrice: number;
  bottleContentMl: number;
  stockBottles: number;
  image: string;
  favorite?: boolean;
};

const SPIRITS: SpiritSeed[] = [
  {
    name: "Gin 0.7l",
    sku: "BAR-GIN-07",
    barcode: "7610800001001",
    categoryCode: "BAR",
    purchasePrice: 28,
    salePrice: 0,
    bottleContentMl: 700,
    stockBottles: 6,
    image: IMG("gin.jpg"),
    favorite: false,
  },
  {
    name: "Tonic Water 0.2l",
    sku: "BAR-TONIC-02",
    barcode: "7610800001002",
    categoryCode: "BAR",
    purchasePrice: 1.2,
    salePrice: 4.5,
    bottleContentMl: 200,
    stockBottles: 24,
    image: IMG("tonic.jpg"),
    favorite: true,
  },
  {
    name: "Limette",
    sku: "BAR-LIME",
    barcode: "7610800001003",
    categoryCode: "BAR",
    purchasePrice: 0.4,
    salePrice: 0,
    bottleContentMl: 0,
    stockBottles: 40,
    image: IMG("lime.jpg"),
  },
  {
    name: "Rum 0.7l",
    sku: "BAR-RUM-07",
    barcode: "7610800001004",
    categoryCode: "BAR",
    purchasePrice: 24,
    salePrice: 0,
    bottleContentMl: 700,
    stockBottles: 4,
    image: IMG("rum.jpg"),
  },
  {
    name: "Vodka 0.7l",
    sku: "BAR-VODKA-07",
    barcode: "7610800001005",
    categoryCode: "BAR",
    purchasePrice: 22,
    salePrice: 0,
    bottleContentMl: 700,
    stockBottles: 5,
    image: IMG("vodka.jpg"),
  },
  {
    name: "Whisky 0.7l",
    sku: "BAR-WHISKY-07",
    barcode: "7610800001006",
    categoryCode: "BAR",
    purchasePrice: 32,
    salePrice: 0,
    bottleContentMl: 700,
    stockBottles: 3,
    image: IMG("whisky.jpg"),
  },
];

type CocktailSeed = {
  name: string;
  salePrice: number;
  image: string;
  instructions: string;
  items: { sku: string; quantity: number; unit: Unit }[];
  favorite?: boolean;
};

const COCKTAILS: CocktailSeed[] = [
  {
    name: "Gin Tonic",
    salePrice: 14.5,
    image: IMG("cocktail-gt.jpg"),
    favorite: true,
    instructions:
      "1. Highball-Glas mit Eis füllen\n2. 40 ml Gin darüber giessen\n3. Mit 120 ml Tonic auffüllen\n4. Einmal vorsichtig umrühren\n5. Limettenscheibe als Garnish",
    items: [
      { sku: "BAR-GIN-07", quantity: 40, unit: "ML" },
      { sku: "BAR-TONIC-02", quantity: 120, unit: "ML" },
      { sku: "BAR-LIME", quantity: 0.25, unit: "PIECE" },
    ],
  },
  {
    name: "Cuba Libre",
    salePrice: 13.5,
    image: IMG("cocktail-cuba.jpg"),
    favorite: true,
    instructions:
      "1. Highball-Glas mit Eis füllen\n2. 40 ml Rum eingiessen\n3. Mit 120 ml Coca-Cola auffüllen\n4. Limettensaft einer Scheibe hinzufügen\n5. Kurz umrühren, Limette garnieren",
    items: [
      { sku: "BAR-RUM-07", quantity: 40, unit: "ML" },
      { sku: "BEV-COKE-033", quantity: 120, unit: "ML" },
      { sku: "BAR-LIME", quantity: 0.25, unit: "PIECE" },
    ],
  },
  {
    name: "Vodka Orange",
    salePrice: 12.5,
    image: IMG("cocktail-vodka-orange.jpg"),
    favorite: true,
    instructions:
      "1. Highball-Glas mit Eis füllen\n2. 40 ml Vodka eingiessen\n3. Mit 120 ml Orangensaft auffüllen\n4. Kurz umrühren\n5. Optional Orangenscheibe garnieren",
    items: [
      { sku: "BAR-VODKA-07", quantity: 40, unit: "ML" },
      { sku: "BEV-OJ", quantity: 120, unit: "ML" },
    ],
  },
  {
    name: "Whisky Cola",
    salePrice: 14.0,
    image: IMG("cocktail-whisky-cola.jpg"),
    favorite: true,
    instructions:
      "1. Tumbler oder Highball mit Eis füllen\n2. 40 ml Whisky eingiessen\n3. Mit 120 ml Coca-Cola auffüllen\n4. Einmal umrühren\n5. Optional Limette oder Orange",
    items: [
      { sku: "BAR-WHISKY-07", quantity: 40, unit: "ML" },
      { sku: "BEV-COKE-033", quantity: 120, unit: "ML" },
    ],
  },
];

async function main() {
  const hotel =
    (await prisma.hotel.findFirst({ where: { slug: "bern" } })) ??
    (await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!hotel) throw new Error("No hotel found — run seed first");

  const lager = await prisma.warehouse.findFirst({
    where: { hotelId: hotel.id, code: "LAGER", isActive: true },
  });
  if (!lager) throw new Error("LAGER warehouse missing");

  const cats = await prisma.productCategory.findMany({
    where: { hotelId: hotel.id },
  });
  const catByCode = Object.fromEntries(cats.map((c) => [c.code, c]));

  const supplier = await prisma.supplier.findFirst({
    where: { hotelId: hotel.id },
  });

  // 1) Images on existing products + matching POS articles
  for (const [sku, imageUrl] of Object.entries(PRODUCT_IMAGES)) {
    const product = await prisma.product.findFirst({
      where: { hotelId: hotel.id, sku },
    });
    if (!product) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl },
    });
    await prisma.posArticle.updateMany({
      where: { hotelId: hotel.id, productId: product.id },
      data: { imageUrl },
    });
    console.log(`image ← ${sku}`);
  }

  // Coke used in recipes as liquid pour: enable trackLiquid (330ml bottle)
  for (const sku of ["BEV-COKE-033", "BEV-COKEZ-033", "BEV-SPRITE-033"]) {
    const p = await prisma.product.findFirst({
      where: { hotelId: hotel.id, sku },
    });
    if (!p) continue;
    // Keep whole-bottle sales working: stock stays in bottles for soft drinks
    // sold as PRODUCT. Recipe pours of Coke use quantity in ML against BOTTLE
    // stock only if trackLiquid — for Cuba Libre we need ml tracking on Coke.
    // Convert existing bottle stock → ml if not already liquid.
    if (!p.trackLiquid) {
      const levels = await prisma.stockLevel.findMany({
        where: { productId: p.id },
      });
      await prisma.product.update({
        where: { id: p.id },
        data: {
          trackLiquid: true,
          bottleContentMl: 330,
          unit: "ML",
          minStock: Number(p.minStock) * 330,
          optimalStock: Number(p.optimalStock) * 330,
          maxStock: Number(p.maxStock) * 330,
        },
      });
      for (const lvl of levels) {
        await prisma.stockLevel.update({
          where: { id: lvl.id },
          data: { quantity: Number(lvl.quantity) * 330 },
        });
      }
      console.log(`liquid ← ${sku}`);
    }
  }

  // OJ for vodka orange — track as liters already; convert to ml liquid
  const oj = await prisma.product.findFirst({
    where: { hotelId: hotel.id, sku: "BEV-OJ" },
  });
  if (oj && !oj.trackLiquid) {
    const levels = await prisma.stockLevel.findMany({
      where: { productId: oj.id },
    });
    await prisma.product.update({
      where: { id: oj.id },
      data: {
        trackLiquid: true,
        bottleContentMl: 1000,
        unit: "ML",
        minStock: Number(oj.minStock) * 1000,
        optimalStock: Number(oj.optimalStock) * 1000,
        maxStock: Number(oj.maxStock) * 1000,
      },
    });
    for (const lvl of levels) {
      await prisma.stockLevel.update({
        where: { id: lvl.id },
        data: { quantity: Number(lvl.quantity) * 1000 },
      });
    }
    console.log("liquid ← BEV-OJ");
  }

  // 2) Spirit / bar ingredients
  const bySku = new Map(
    (
      await prisma.product.findMany({ where: { hotelId: hotel.id } })
    ).map((p) => [p.sku, p])
  );

  for (const s of SPIRITS) {
    const cat = catByCode[s.categoryCode];
    if (!cat) throw new Error(`category ${s.categoryCode} missing`);

    const isLime = s.sku === "BAR-LIME";
    let product = bySku.get(s.sku);
    if (!product) {
      const stockQty = isLime
        ? s.stockBottles
        : s.stockBottles * s.bottleContentMl;
      product = await prisma.product.create({
        data: {
          hotelId: hotel.id,
          categoryId: cat.id,
          supplierId: supplier?.id ?? null,
          name: s.name,
          sku: s.sku,
          barcode: s.barcode,
          ean: s.barcode,
          unit: isLime ? "PIECE" : "ML",
          purchasePrice: s.purchasePrice,
          salePrice: s.salePrice,
          vatRate: 8.1,
          trackLiquid: !isLime,
          bottleContentMl: isLime ? null : s.bottleContentMl,
          minStock: isLime ? 20 : 2 * s.bottleContentMl,
          optimalStock: isLime ? 40 : 6 * s.bottleContentMl,
          maxStock: isLime ? 80 : 12 * s.bottleContentMl,
          imageUrl: s.image,
          isFavorite: !!s.favorite,
          isActive: true,
        },
      });
      await prisma.stockLevel.create({
        data: {
          productId: product.id,
          warehouseId: lager.id,
          quantity: stockQty,
          lastMovementAt: new Date(),
        },
      });
      if (supplier) {
        await prisma.supplierProduct.create({
          data: {
            supplierId: supplier.id,
            productId: product.id,
            purchasePrice: s.purchasePrice,
          },
        });
      }
      console.log(`product + ${s.sku}`);
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: s.image },
      });
      console.log(`product ~ ${s.sku}`);
    }
    bySku.set(s.sku, product);

    // Sellable tonic as POS product if salePrice > 0
    if (s.salePrice > 0) {
      const existingPos = await prisma.posArticle.findFirst({
        where: { hotelId: hotel.id, productId: product.id },
      });
      const posCat = await prisma.posCategory.findFirst({
        where: { hotelId: hotel.id, code: s.categoryCode },
      });
      if (!existingPos) {
        await prisma.posArticle.create({
          data: {
            hotelId: hotel.id,
            type: "PRODUCT",
            productId: product.id,
            posCategoryId: posCat?.id ?? null,
            name: s.name,
            salePrice: s.salePrice,
            vatRate: 8.1,
            imageUrl: s.image,
            isFavorite: !!s.favorite,
            isActive: true,
            sortOrder: 200,
          },
        });
        console.log(`pos product + ${s.sku}`);
      } else {
        await prisma.posArticle.update({
          where: { id: existingPos.id },
          data: { imageUrl: s.image },
        });
      }
    }
  }

  // Refresh sku map
  for (const p of await prisma.product.findMany({
    where: { hotelId: hotel.id },
  })) {
    bySku.set(p.sku, p);
  }

  const barPosCat =
    (await prisma.posCategory.findFirst({
      where: { hotelId: hotel.id, code: "BAR" },
    })) ??
    (await prisma.posCategory.create({
      data: {
        hotelId: hotel.id,
        name: "Bar",
        code: "BAR",
        sortOrder: 2,
        isActive: true,
      },
    }));

  // 3) Cocktail recipes + POS articles
  for (const c of COCKTAILS) {
    let recipe = await prisma.recipe.findFirst({
      where: { hotelId: hotel.id, name: c.name, isActive: true },
      include: { items: true, posArticles: true },
    });

    const itemData = c.items.map((i, idx) => {
      const prod = bySku.get(i.sku);
      if (!prod) throw new Error(`Missing ingredient ${i.sku} for ${c.name}`);
      return {
        productId: prod.id,
        quantity: i.quantity,
        unit: i.unit,
        sortOrder: idx,
      };
    });

    if (!recipe) {
      recipe = await prisma.recipe.create({
        data: {
          hotelId: hotel.id,
          name: c.name,
          version: 1,
          isActive: true,
          instructions: c.instructions,
          items: { create: itemData },
        },
        include: { items: true, posArticles: true },
      });
      console.log(`recipe + ${c.name}`);
    } else {
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { instructions: c.instructions },
      });
      await prisma.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
      await prisma.recipeItem.createMany({
        data: itemData.map((i) => ({ ...i, recipeId: recipe!.id })),
      });
      console.log(`recipe ~ ${c.name}`);
    }

    const existingArticle = await prisma.posArticle.findFirst({
      where: { hotelId: hotel.id, recipeId: recipe.id },
    });
    if (!existingArticle) {
      await prisma.posArticle.create({
        data: {
          hotelId: hotel.id,
          type: "RECIPE",
          recipeId: recipe.id,
          posCategoryId: barPosCat.id,
          name: c.name,
          description: "Cocktail",
          salePrice: c.salePrice,
          vatRate: 8.1,
          imageUrl: c.image,
          isFavorite: !!c.favorite,
          isActive: true,
          sortOrder: 50,
        },
      });
      console.log(`pos recipe + ${c.name}`);
    } else {
      await prisma.posArticle.update({
        where: { id: existingArticle.id },
        data: {
          imageUrl: c.image,
          salePrice: c.salePrice,
          isFavorite: !!c.favorite,
        },
      });
      console.log(`pos recipe ~ ${c.name}`);
    }
  }

  console.log("Done enriching bar media for", hotel.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
