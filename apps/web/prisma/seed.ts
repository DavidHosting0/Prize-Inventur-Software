import { PrismaClient, Unit } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "@prize/types";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Prize Hotel demo data...");

  await prisma.deliveryNotePage.deleteMany();
  await prisma.deliveryNoteScan.deleteMany();
  await prisma.systemIntegration.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.posPriceHistory.deleteMany();
  await prisma.posArticle.deleteMany();
  await prisma.posCategory.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.inventoryCountItem.deleteMany();
  await prisma.inventoryCount.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.waste.deleteMany();
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.supplierProduct.deleteMany();
  await prisma.minibarRecord.deleteMany();
  await prisma.breakfastRecord.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userHotel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Prize by Radisson" },
  });

  const hotel = await prisma.hotel.create({
    data: {
      organizationId: org.id,
      name: "Prize Bern",
      slug: "bern",
      address: "Bahnhofstrasse 10",
      city: "Bern",
      country: "CH",
      currency: "CHF",
      locale: "de-CH",
      timezone: "Europe/Zurich",
      imageUrl: "/hotels/prize-bern.svg",
      posSettings: {
        vouchers: [
          { code: "CLUB", name: "Club", discountPercent: 10 },
          { code: "PREMIUM", name: "Premium", discountPercent: 15 },
          { code: "VIP", name: "VIP", discountPercent: 20 },
        ],
        complimentaryReasons: [
          "Mitarbeiter-Konsum",
          "Gäste-Kulanz",
          "Marketing / Probe",
          "Interne Veranstaltung",
          "Beschwerde / Kompensation",
          "Management",
        ],
      },
    },
  });

  const warehouseDefs = [
    { name: "Lager", code: "LAGER" },
  ];

  const warehouses = Object.fromEntries(
    await Promise.all(
      warehouseDefs.map(async (w) => {
        const row = await prisma.warehouse.create({
          data: { hotelId: hotel.id, ...w },
        });
        return [w.code, row] as const;
      })
    )
  );
  // Alias for seed product placement (all stock goes to central Lager)
  const lager = warehouses.LAGER!;
  Object.assign(warehouses, {
    MAIN: lager,
    KITCHEN: lager,
    BAR: lager,
    BREAKFAST: lager,
    RECEPTION: lager,
    MINIBAR: lager,
    HK: lager,
  });

  const permissionRows = await Promise.all(
    PERMISSIONS.map((code) =>
      prisma.permission.create({
        data: { code, description: code },
      })
    )
  );

  const allPermIds = permissionRows.map((p) => p.id);

  async function createRole(
    code: string,
    name: string,
    codes: string[],
    scope: "GROUP" | "HOTEL" = "HOTEL"
  ) {
    const role = await prisma.role.create({ data: { code, name, scope } });
    const selected = permissionRows.filter((p) => codes.includes(p.code));
    await prisma.rolePermission.createMany({
      data: selected.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    return role;
  }

  const groupAdminRole = await prisma.role.create({
    data: { code: "GROUP_ADMIN", name: "Group Administrator", scope: "GROUP" },
  });
  await prisma.rolePermission.createMany({
    data: allPermIds.map((permissionId) => ({
      roleId: groupAdminRole.id,
      permissionId,
    })),
  });

  await createRole(
    "GROUP_MANAGER",
    "Group Manager",
    [
      "hotels.view",
      "hotels.manage",
      "analytics.view",
      "analytics.view_all_hotels",
      "analytics.export",
      "users.view",
      "users.create",
      "users.edit",
      "audit.view",
      "dashboard.view",
      "reports.view",
      "settings.manage",
    ],
    "GROUP"
  );

  await createRole(
    "GROUP_ANALYST",
    "Group Analyst",
    [
      "analytics.view",
      "analytics.view_all_hotels",
      "analytics.export",
      "hotels.view",
      "dashboard.view",
      "reports.view",
      "audit.view",
    ],
    "GROUP"
  );

  await createRole(
    "GROUP_VIEWER",
    "Group Viewer",
    ["dashboard.view", "hotels.view", "analytics.view", "reports.view"],
    "GROUP"
  );

  const adminRole = await prisma.role.create({
    data: { code: "ADMIN", name: "Administrator", scope: "HOTEL" },
  });
  await prisma.rolePermission.createMany({
    data: allPermIds.map((permissionId) => ({
      roleId: adminRole.id,
      permissionId,
    })),
  });

  const fbRole = await createRole("FB_MANAGER", "F&B Manager", [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.edit",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.close",
    "stock.view",
    "stock.adjust",
    "pos.sell",
    "pos.refund",
    "pos.cancel",
    "pos.discount",
    "cash.close",
    "pos_config.view",
    "pos_config.create",
    "pos_config.edit",
    "pos_config.delete",
    "pos_config.manage_categories",
    "pos_config.manage_prices",
    "pos_config.manage_recipes",
    "pos_config.manage_layout",
    "recipes.view",
    "recipes.manage",
    "reports.view",
    "search.use",
  ]);

  const barRole = await createRole("BAR", "Bar", [
    "dashboard.view",
    "products.view",
    "stock.view",
    "pos.sell",
    "pos.cancel",
    "pos.discount",
    "pos.refund",
    "cash.close",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "search.use",
  ]);

  await createRole("WAREHOUSE_MANAGER", "Lagerleiter", [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.edit",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.close",
    "stock.view",
    "stock.adjust",
    "reports.view",
    "search.use",
  ]);

  const passwordHash = await bcrypt.hash("Demo123!", 10);

  // Second hotel for multi-hotel / group demos
  const hotel2 = await prisma.hotel.create({
    data: {
      organizationId: org.id,
      name: "Prize Zurich",
      slug: "zurich",
      address: "Bahnhofplatz 1",
      city: "Zurich",
      country: "CH",
      currency: "CHF",
      locale: "de-CH",
      timezone: "Europe/Zurich",
      imageUrl: "/hotels/prize-zurich.svg",
      posSettings: {
        vouchers: [
          { code: "CLUB", name: "Club", discountPercent: 10 },
          { code: "PREMIUM", name: "Premium", discountPercent: 15 },
          { code: "VIP", name: "VIP", discountPercent: 20 },
        ],
        complimentaryReasons: [
          "Mitarbeiter-Konsum",
          "Gäste-Kulanz",
          "Marketing / Probe",
          "Interne Veranstaltung",
          "Beschwerde / Kompensation",
          "Management",
        ],
      },
    },
  });
  await prisma.warehouse.create({
    data: { hotelId: hotel2.id, name: "Lager", code: "LAGER" },
  });
  await prisma.cashRegister.create({
    data: {
      hotelId: hotel2.id,
      name: "Hauptkasse",
      code: "MAIN",
      isActive: true,
    },
  });
  const hotel2Categories = [
    { name: "Getränke", code: "DRINKS", sortOrder: 1 },
    { name: "Bar", code: "BAR", sortOrder: 2 },
    { name: "Frühstück", code: "BREAKFAST", sortOrder: 3 },
    { name: "Restaurant", code: "RESTAURANT", sortOrder: 4 },
    { name: "Snacks", code: "SNACKS", sortOrder: 5 },
    { name: "Minibar", code: "MINIBAR", sortOrder: 6 },
    { name: "Sonstiges", code: "OTHER", sortOrder: 7 },
  ];
  await prisma.productCategory.createMany({
    data: hotel2Categories.map((c) => ({ hotelId: hotel2.id, ...c })),
  });
  await prisma.posCategory.createMany({
    data: hotel2Categories.map((c) => ({
      hotelId: hotel2.id,
      name: c.name,
      code: c.code,
      sortOrder: c.sortOrder,
      isActive: true,
    })),
  });

  await prisma.user.create({
    data: {
      email: "group.admin@prize-radisson.ch",
      username: "groupadmin",
      name: "Group Admin",
      passwordHash,
      roleId: groupAdminRole.id,
      organizationId: org.id,
      accountType: "GROUP",
      locale: "de",
      hotels: {
        create: [
          { hotelId: hotel.id, isDefault: true },
          { hotelId: hotel2.id, isDefault: false },
        ],
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@demo-hotel.ch",
      username: "admin",
      name: "Demo Admin",
      passwordHash,
      roleId: adminRole.id,
      organizationId: org.id,
      accountType: "HOTEL",
      locale: "de",
      hotels: { create: { hotelId: hotel.id, isDefault: true } },
    },
  });

  await prisma.user.create({
    data: {
      email: "bar@demo-hotel.ch",
      username: "bar01",
      name: "Bar Staff",
      passwordHash,
      roleId: barRole.id,
      organizationId: org.id,
      accountType: "HOTEL",
      locale: "de",
      hotels: { create: { hotelId: hotel.id, isDefault: true } },
    },
  });

  await prisma.user.create({
    data: {
      email: "fb@demo-hotel.ch",
      username: "fbmanager",
      name: "F&B Manager",
      passwordHash,
      roleId: fbRole.id,
      organizationId: org.id,
      accountType: "HOTEL",
      locale: "en",
      hotels: { create: { hotelId: hotel.id, isDefault: true } },
    },
  });

  const categories = Object.fromEntries(
    await Promise.all(
      [
        { name: "Getränke", code: "DRINKS", sortOrder: 1 },
        { name: "Bar", code: "BAR", sortOrder: 2 },
        { name: "Frühstück", code: "BREAKFAST", sortOrder: 3 },
        { name: "Restaurant", code: "RESTAURANT", sortOrder: 4 },
        { name: "Snacks", code: "SNACKS", sortOrder: 5 },
        { name: "Minibar", code: "MINIBAR", sortOrder: 6 },
        { name: "Sonstiges", code: "OTHER", sortOrder: 7 },
      ].map(async (c) => {
        const row = await prisma.productCategory.create({
          data: { hotelId: hotel.id, ...c },
        });
        return [c.code, row] as const;
      })
    )
  );

  const supplier = await prisma.supplier.create({
    data: {
      hotelId: hotel.id,
      name: "Getränke AG Bern",
      address: "Industriestrasse 5, 3012 Bern",
      contactName: "Hans Meier",
      phone: "+41 31 000 00 00",
      email: "order@getraenke-bern.ch",
      leadTimeDays: 2,
      minOrderValue: 150,
    },
  });

  type ProdSeed = {
    name: string;
    sku: string;
    barcode: string;
    category: string;
    unit: Unit;
    purchasePrice: number;
    salePrice: number;
    minStock: number;
    optimalStock: number;
    maxStock: number;
    stock: number;
    favorite?: boolean;
    warehouse?: string;
    image?: string;
    trackLiquid?: boolean;
    bottleContentMl?: number;
  };

  const img = (file: string) => `/seed-images/${file}`;

  const productSeeds: ProdSeed[] = [
    {
      name: "Coca-Cola 0.33",
      sku: "BEV-COKE-033",
      barcode: "5449000000996",
      category: "DRINKS",
      unit: "ML",
      purchasePrice: 0.82,
      salePrice: 4.5,
      minStock: 24 * 330,
      optimalStock: 96 * 330,
      maxStock: 200 * 330,
      stock: 84 * 330,
      favorite: true,
      warehouse: "BAR",
      image: img("coke.jpg"),
      trackLiquid: true,
      bottleContentMl: 330,
    },
    {
      name: "Coca-Cola Zero 0.33",
      sku: "BEV-COKEZ-033",
      barcode: "5449000131805",
      category: "DRINKS",
      unit: "ML",
      purchasePrice: 0.82,
      salePrice: 4.5,
      minStock: 24 * 330,
      optimalStock: 72 * 330,
      maxStock: 150 * 330,
      stock: 60 * 330,
      favorite: true,
      warehouse: "BAR",
      image: img("coke-zero.jpg"),
      trackLiquid: true,
      bottleContentMl: 330,
    },
    {
      name: "Sprite 0.33",
      sku: "BEV-SPRITE-033",
      barcode: "5449000000439",
      category: "DRINKS",
      unit: "ML",
      purchasePrice: 0.8,
      salePrice: 4.5,
      minStock: 24 * 330,
      optimalStock: 72 * 330,
      maxStock: 150 * 330,
      stock: 18 * 330,
      warehouse: "BAR",
      image: img("sprite.jpg"),
      trackLiquid: true,
      bottleContentMl: 330,
    },
    {
      name: "Wasser 0.5",
      sku: "BEV-WATER-05",
      barcode: "7610057001001",
      category: "DRINKS",
      unit: "BOTTLE",
      purchasePrice: 0.35,
      salePrice: 3.5,
      minStock: 48,
      optimalStock: 120,
      maxStock: 300,
      stock: 140,
      favorite: true,
      warehouse: "BAR",
      image: img("water.jpg"),
    },
    {
      name: "Bier 0.33",
      sku: "BAR-BEER-033",
      barcode: "7610058012345",
      category: "BAR",
      unit: "BOTTLE",
      purchasePrice: 1.1,
      salePrice: 6.5,
      minStock: 48,
      optimalStock: 120,
      maxStock: 240,
      stock: 95,
      favorite: true,
      warehouse: "BAR",
      image: img("beer.jpg"),
    },
    {
      name: "Kaffee",
      sku: "BF-COFFEE",
      barcode: "7610100001111",
      category: "BREAKFAST",
      unit: "KG",
      purchasePrice: 18.5,
      salePrice: 0,
      minStock: 5,
      optimalStock: 15,
      maxStock: 30,
      stock: 8,
      warehouse: "BREAKFAST",
      image: img("coffee.jpg"),
    },
    {
      name: "Milch",
      sku: "BF-MILK",
      barcode: "7610200002222",
      category: "BREAKFAST",
      unit: "LITER",
      purchasePrice: 1.45,
      salePrice: 0,
      minStock: 20,
      optimalStock: 40,
      maxStock: 80,
      stock: 8,
      warehouse: "BREAKFAST",
      image: img("milk.jpg"),
    },
    {
      name: "Eier",
      sku: "BF-EGGS",
      barcode: "7610300003333",
      category: "BREAKFAST",
      unit: "PIECE",
      purchasePrice: 0.45,
      salePrice: 0,
      minStock: 60,
      optimalStock: 120,
      maxStock: 240,
      stock: 90,
      warehouse: "BREAKFAST",
      image: img("eggs.jpg"),
    },
    {
      name: "Croissant",
      sku: "BF-CROISSANT",
      barcode: "7610400004444",
      category: "BREAKFAST",
      unit: "PIECE",
      purchasePrice: 0.95,
      salePrice: 3.5,
      minStock: 30,
      optimalStock: 80,
      maxStock: 150,
      stock: 45,
      favorite: true,
      warehouse: "BREAKFAST",
      image: img("croissant.jpg"),
    },
    {
      name: "Brötchen",
      sku: "BF-BREADROLL",
      barcode: "7610500005555",
      category: "BREAKFAST",
      unit: "PIECE",
      purchasePrice: 0.55,
      salePrice: 0,
      minStock: 40,
      optimalStock: 100,
      maxStock: 200,
      stock: 70,
      warehouse: "BREAKFAST",
      image: img("bread.jpg"),
    },
    {
      name: "Butter",
      sku: "BF-BUTTER",
      barcode: "7610600006666",
      category: "BREAKFAST",
      unit: "KG",
      purchasePrice: 9.8,
      salePrice: 0,
      minStock: 2,
      optimalStock: 5,
      maxStock: 10,
      stock: 3.5,
      warehouse: "BREAKFAST",
      image: img("butter.jpg"),
    },
    {
      name: "Orangensaft",
      sku: "BEV-OJ",
      barcode: "7610700007777",
      category: "DRINKS",
      unit: "ML",
      purchasePrice: 2.4,
      salePrice: 5.5,
      minStock: 10 * 1000,
      optimalStock: 25 * 1000,
      maxStock: 50 * 1000,
      stock: 12 * 1000,
      warehouse: "BREAKFAST",
      image: img("orange-juice.jpg"),
      trackLiquid: true,
      bottleContentMl: 1000,
    },
    {
      name: "Minibar Wasser 0.5",
      sku: "MB-WATER-05",
      barcode: "7610700008888",
      category: "MINIBAR",
      unit: "BOTTLE",
      purchasePrice: 0.45,
      salePrice: 4.0,
      minStock: 24,
      optimalStock: 60,
      maxStock: 120,
      stock: 48,
      warehouse: "MINIBAR",
      image: img("water.jpg"),
    },
    {
      name: "Minibar Schokolade",
      sku: "MB-CHOC",
      barcode: "7610700009999",
      category: "MINIBAR",
      unit: "PIECE",
      purchasePrice: 0.9,
      salePrice: 5.5,
      minStock: 20,
      optimalStock: 40,
      maxStock: 80,
      stock: 36,
      warehouse: "MINIBAR",
      image: img("chocolate.jpg"),
    },
    {
      name: "Minibar Soft Drink",
      sku: "MB-SOFT",
      barcode: "7610700010001",
      category: "MINIBAR",
      unit: "BOTTLE",
      purchasePrice: 0.7,
      salePrice: 4.5,
      minStock: 24,
      optimalStock: 48,
      maxStock: 96,
      stock: 40,
      warehouse: "MINIBAR",
      image: img("soft-drink.jpg"),
    },
    {
      name: "Gin 0.7l",
      sku: "BAR-GIN-07",
      barcode: "7610800001001",
      category: "BAR",
      unit: "ML",
      purchasePrice: 28,
      salePrice: 0,
      minStock: 1400,
      optimalStock: 4200,
      maxStock: 8400,
      stock: 4200,
      warehouse: "BAR",
      image: img("gin.jpg"),
      trackLiquid: true,
      bottleContentMl: 700,
    },
    {
      name: "Tonic Water 0.2l",
      sku: "BAR-TONIC-02",
      barcode: "7610800001002",
      category: "BAR",
      unit: "ML",
      purchasePrice: 1.2,
      salePrice: 4.5,
      minStock: 480,
      optimalStock: 2400,
      maxStock: 4800,
      stock: 4800,
      favorite: true,
      warehouse: "BAR",
      image: img("tonic.jpg"),
      trackLiquid: true,
      bottleContentMl: 200,
    },
    {
      name: "Limette",
      sku: "BAR-LIME",
      barcode: "7610800001003",
      category: "BAR",
      unit: "PIECE",
      purchasePrice: 0.4,
      salePrice: 0,
      minStock: 20,
      optimalStock: 40,
      maxStock: 80,
      stock: 40,
      warehouse: "BAR",
      image: img("lime.jpg"),
    },
    {
      name: "Rum 0.7l",
      sku: "BAR-RUM-07",
      barcode: "7610800001004",
      category: "BAR",
      unit: "ML",
      purchasePrice: 24,
      salePrice: 0,
      minStock: 1400,
      optimalStock: 2800,
      maxStock: 5600,
      stock: 2800,
      warehouse: "BAR",
      image: img("rum.jpg"),
      trackLiquid: true,
      bottleContentMl: 700,
    },
    {
      name: "Vodka 0.7l",
      sku: "BAR-VODKA-07",
      barcode: "7610800001005",
      category: "BAR",
      unit: "ML",
      purchasePrice: 22,
      salePrice: 0,
      minStock: 1400,
      optimalStock: 3500,
      maxStock: 7000,
      stock: 3500,
      warehouse: "BAR",
      image: img("vodka.jpg"),
      trackLiquid: true,
      bottleContentMl: 700,
    },
    {
      name: "Whisky 0.7l",
      sku: "BAR-WHISKY-07",
      barcode: "7610800001006",
      category: "BAR",
      unit: "ML",
      purchasePrice: 32,
      salePrice: 0,
      minStock: 1400,
      optimalStock: 2100,
      maxStock: 4200,
      stock: 2100,
      warehouse: "BAR",
      image: img("whisky.jpg"),
      trackLiquid: true,
      bottleContentMl: 700,
    },
  ];

  const products = [];
  for (const p of productSeeds) {
    const product = await prisma.product.create({
      data: {
        hotelId: hotel.id,
        categoryId: categories[p.category]!.id,
        supplierId: supplier.id,
        name: p.name,
        sku: p.sku,
        ean: p.barcode,
        barcode: p.barcode,
        unit: p.unit,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        vatRate: 8.1,
        minStock: p.minStock,
        optimalStock: p.optimalStock,
        maxStock: p.maxStock,
        isFavorite: !!p.favorite,
        isActive: true,
        imageUrl: p.image ?? null,
        trackLiquid: !!p.trackLiquid,
        bottleContentMl: p.trackLiquid ? p.bottleContentMl ?? null : null,
      },
    });
    products.push(product);

    const wh = warehouses[p.warehouse ?? "LAGER"]!;
    await prisma.stockLevel.create({
      data: {
        productId: product.id,
        warehouseId: wh.id,
        quantity: p.stock,
        lastMovementAt: new Date(),
      },
    });

    await prisma.supplierProduct.create({
      data: {
        supplierId: supplier.id,
        productId: product.id,
        purchasePrice: p.purchasePrice,
      },
    });
  }

  const register = await prisma.cashRegister.create({
    data: {
      hotelId: hotel.id,
      name: "Bar Kasse 1",
      code: "BAR-1",
    },
  });

  const session = await prisma.cashSession.create({
    data: {
      cashRegisterId: register.id,
      openedById: admin.id,
      status: "OPEN",
    },
  });

  // Seed paid sales for dashboard charts (last 14 days) — also reduce BAR stock
  const coke = products.find((p) => p.sku === "BEV-COKE-033")!;
  const beer = products.find((p) => p.sku === "BAR-BEER-033")!;
  const water = products.find((p) => p.sku === "BEV-WATER-05")!;
  const sellables = [coke, beer, water];

  const barStock = new Map<string, number>();
  for (const p of sellables) {
    const level = await prisma.stockLevel.findUnique({
      where: {
        productId_warehouseId: {
          productId: p.id,
          warehouseId: warehouses.BAR!.id,
        },
      },
    });
    barStock.set(p.id, Number(level?.quantity ?? 0));
  }

  for (let day = 0; day < 14; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const salesPerDay = 3 + (day % 4);
    for (let s = 0; s < salesPerDay; s++) {
      const product = sellables[s % sellables.length]!;
      const qty = 1 + (s % 3);
      const beforeQty = barStock.get(product.id) ?? 0;
      if (beforeQty < qty) continue;
      const afterQty = beforeQty - qty;
      barStock.set(product.id, afterQty);

      const lineTotal = Number(product.salePrice) * qty;
      const tax = lineTotal - lineTotal / 1.081;
      const txNo = `TX-SEED-${day}-${s}`;
      const sale = await prisma.sale.create({
        data: {
          hotelId: hotel.id,
          warehouseId: warehouses.BAR!.id,
          cashierId: admin.id,
          cashRegisterId: register.id,
          cashSessionId: day === 0 ? session.id : null,
          status: "PAID",
          subtotal: lineTotal,
          discountAmount: 0,
          taxAmount: tax,
          total: lineTotal,
          currency: "CHF",
          transactionNo: txNo,
          paidAt: date,
          createdAt: date,
          items: {
            create: [
              {
                productId: product.id,
                quantity: qty,
                unitPrice: product.salePrice,
                vatRate: 8.1,
                lineTotal,
                nameSnapshot: product.name,
              },
            ],
          },
          payments: {
            create: [
              {
                method: s % 3 === 0 ? "CASH" : s % 3 === 1 ? "CARD" : "TWINT",
                amount: lineTotal,
                currency: "CHF",
                createdAt: date,
              },
            ],
          },
        },
      });

      await prisma.inventoryMovement.create({
        data: {
          hotelId: hotel.id,
          productId: product.id,
          warehouseId: warehouses.BAR!.id,
          userId: admin.id,
          type: "SALE",
          quantity: -qty,
          quantityBefore: beforeQty,
          quantityAfter: afterQty,
          reason: "POS Verkauf",
          referenceType: "Sale",
          referenceId: sale.id,
          createdAt: date,
        },
      });
    }
  }

  for (const [productId, qty] of barStock) {
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: warehouses.BAR!.id,
        },
      },
      data: { quantity: qty, lastMovementAt: new Date() },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        hotelId: hotel.id,
        title: "Mindestbestand erreicht",
        body: "Milch liegt unter dem Mindestbestand.",
        type: "STOCK_LOW",
      },
      {
        hotelId: hotel.id,
        title: "Kritischer Bestand",
        body: "Sprite 0.33 unter Mindestbestand.",
        type: "STOCK_CRITICAL",
      },
      {
        hotelId: hotel.id,
        title: "Minibar bereit",
        body: "Minibar-Lager wurde mit Demoartikeln befuellt.",
        type: "INFO",
      },
    ],
  });

  // Backfill POS categories + articles from sellable Lager products
  const invCategories = await prisma.productCategory.findMany({
    where: { hotelId: hotel.id },
    orderBy: { sortOrder: "asc" },
  });
  const posCatByInvId = new Map<string, string>();
  for (const cat of invCategories) {
    const row = await prisma.posCategory.create({
      data: {
        hotelId: hotel.id,
        name: cat.name,
        code: cat.code,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
    posCatByInvId.set(cat.id, row.id);
  }
  const sellable = await prisma.product.findMany({
    where: { hotelId: hotel.id, isActive: true, salePrice: { gt: 0 } },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
  });
  let sort = 0;
  for (const p of sellable) {
    await prisma.posArticle.create({
      data: {
        hotelId: hotel.id,
        type: "PRODUCT",
        productId: p.id,
        posCategoryId: posCatByInvId.get(p.categoryId) ?? null,
        name: p.name,
        description: p.description,
        salePrice: p.salePrice,
        vatRate: p.vatRate,
        imageUrl: p.imageUrl,
        sortOrder: sort++,
        isFavorite: p.isFavorite,
        isActive: true,
      },
    });
  }

  // Cocktail recipes for the bar
  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
  const barPosCatId =
    (
      await prisma.posCategory.findFirst({
        where: { hotelId: hotel.id, code: "BAR" },
      })
    )?.id ?? null;

  const cocktails: {
    name: string;
    salePrice: number;
    image: string;
    instructions: string;
    favorite?: boolean;
    items: { sku: string; quantity: number; unit: Unit }[];
  }[] = [
    {
      name: "Gin Tonic",
      salePrice: 14.5,
      image: img("cocktail-gt.jpg"),
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
      image: img("cocktail-cuba.jpg"),
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
      image: img("cocktail-vodka-orange.jpg"),
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
      image: img("cocktail-whisky-cola.jpg"),
      favorite: true,
      instructions:
        "1. Tumbler oder Highball mit Eis füllen\n2. 40 ml Whisky eingiessen\n3. Mit 120 ml Coca-Cola auffüllen\n4. Einmal umrühren\n5. Optional Limette oder Orange",
      items: [
        { sku: "BAR-WHISKY-07", quantity: 40, unit: "ML" },
        { sku: "BEV-COKE-033", quantity: 120, unit: "ML" },
      ],
    },
  ];

  for (const c of cocktails) {
    const recipe = await prisma.recipe.create({
      data: {
        hotelId: hotel.id,
        name: c.name,
        version: 1,
        isActive: true,
        instructions: c.instructions,
        items: {
          create: c.items.map((i, idx) => ({
            productId: bySku[i.sku]!.id,
            quantity: i.quantity,
            unit: i.unit,
            sortOrder: idx,
          })),
        },
      },
    });
    await prisma.posArticle.create({
      data: {
        hotelId: hotel.id,
        type: "RECIPE",
        recipeId: recipe.id,
        posCategoryId: barPosCatId,
        name: c.name,
        description: "Cocktail",
        salePrice: c.salePrice,
        vatRate: 8.1,
        imageUrl: c.image,
        isFavorite: !!c.favorite,
        isActive: true,
        sortOrder: sort++,
      },
    });
  }

  console.log("Seed complete.");
  console.log("GROUP: group.admin@prize-radisson.ch / Demo123!");
  console.log("HOTEL: admin@demo-hotel.ch / Demo123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
