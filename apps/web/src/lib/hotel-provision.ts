import {
  DEFAULT_COMPLIMENTARY_REASONS,
  DEFAULT_VOUCHER_PRESETS,
} from "@prize/types";
import { prisma } from "./db";
import { ensureCentralWarehouse } from "./warehouse";

const DEFAULT_CATEGORIES = [
  { name: "Getränke", code: "DRINKS", sortOrder: 1 },
  { name: "Bar", code: "BAR", sortOrder: 2 },
  { name: "Frühstück", code: "BREAKFAST", sortOrder: 3 },
  { name: "Restaurant", code: "RESTAURANT", sortOrder: 4 },
  { name: "Snacks", code: "SNACKS", sortOrder: 5 },
  { name: "Minibar", code: "MINIBAR", sortOrder: 6 },
  { name: "Sonstiges", code: "OTHER", sortOrder: 7 },
] as const;

/**
 * Provision operational defaults for a newly created hotel so it is usable
 * immediately (Lager, categories, POS presets, register, POS categories).
 */
export async function provisionNewHotel(hotelId: string) {
  await ensureCentralWarehouse(hotelId);

  await prisma.productCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      hotelId,
      name: c.name,
      code: c.code,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true,
  });

  for (const c of DEFAULT_CATEGORIES) {
    await prisma.posCategory.upsert({
      where: { hotelId_name: { hotelId, name: c.name } },
      create: {
        hotelId,
        name: c.name,
        code: c.code,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      update: {},
    });
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      posSettings: {
        vouchers: DEFAULT_VOUCHER_PRESETS,
        complimentaryReasons: [...DEFAULT_COMPLIMENTARY_REASONS],
      },
    },
  });

  const existingRegister = await prisma.cashRegister.findFirst({
    where: { hotelId },
  });
  if (!existingRegister) {
    await prisma.cashRegister.create({
      data: {
        hotelId,
        name: "Hauptkasse",
        code: "MAIN",
        isActive: true,
      },
    });
  }

  return { hotelId, provisioned: true as const };
}

export { DEFAULT_CATEGORIES };
