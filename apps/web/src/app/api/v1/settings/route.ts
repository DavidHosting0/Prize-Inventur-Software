import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { parseComplimentaryReasons } from "@/lib/pos-bootstrap";
import { parseInventorySettings } from "@/lib/inventory-settings";
import {
  DEFAULT_COMPLIMENTARY_REASONS,
  DEFAULT_INVENTORY_SETTINGS,
} from "@prize/types";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "settings.manage");
    const { hotelId } = await requireHotelContext(user);

    const hotel = await prisma.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      select: {
        id: true,
        name: true,
        currency: true,
        locale: true,
        timezone: true,
        address: true,
        city: true,
        country: true,
        posSettings: true,
        inventorySettings: true,
      },
    });
    const warehouses = await prisma.warehouse.findMany({
      where: { hotelId: hotelId },
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    });

    const complimentaryReasons = parseComplimentaryReasons(hotel.posSettings);
    const hasCustomReasons =
      hotel.posSettings &&
      typeof hotel.posSettings === "object" &&
      "complimentaryReasons" in hotel.posSettings;

    return NextResponse.json({
      hotel: {
        id: hotel.id,
        name: hotel.name,
        currency: hotel.currency,
        locale: hotel.locale,
        timezone: hotel.timezone,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
      },
      warehouses,
      complimentaryReasons,
      complimentaryReasonsIsDefault: !hasCustomReasons,
      defaultComplimentaryReasons: [...DEFAULT_COMPLIMENTARY_REASONS],
      inventorySettings: parseInventorySettings(hotel.inventorySettings),
      defaultInventorySettings: DEFAULT_INVENTORY_SETTINGS,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const inventorySettingsSchema = z.object({
  requireReviewBeforeClose: z.boolean(),
  allowCloseWithUncounted: z.boolean(),
  uncountedMeansZero: z.boolean(),
  liquidPresets: z.array(z.coerce.number().min(0).max(20)).min(1).max(20),
  liquidStep: z.coerce.number().min(0.01).max(1),
  staleOpenDays: z.coerce.number().int().min(1).max(365),
  showMlAlongsideBottles: z.boolean(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  timezone: z.string().max(64).optional(),
  complimentaryReasons: z
    .array(z.string().trim().min(1).max(120))
    .max(40)
    .optional(),
  inventorySettings: inventorySettingsSchema.optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "settings.manage");
    const { hotelId } = await requireHotelContext(user);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const { complimentaryReasons, inventorySettings, ...hotelFields } =
      parsed.data;

    const data: Prisma.HotelUpdateInput = { ...hotelFields };

    if (complimentaryReasons !== undefined) {
      const current = await prisma.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { posSettings: true },
      });
      const prev =
        current.posSettings &&
        typeof current.posSettings === "object" &&
        !Array.isArray(current.posSettings)
          ? (current.posSettings as Record<string, unknown>)
          : {};
      const cleaned = complimentaryReasons
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
      data.posSettings = {
        ...prev,
        complimentaryReasons: cleaned,
      } as Prisma.InputJsonValue;
    }

    if (inventorySettings !== undefined) {
      data.inventorySettings = parseInventorySettings(
        inventorySettings
      ) as unknown as Prisma.InputJsonValue;
    }

    const hotel = await prisma.hotel.update({
      where: { id: hotelId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        hotelId,
        userId: user.id,
        accountType: user.accountType,
        action: "settings.hotel.update",
        entity: "Hotel",
        entityId: hotel.id,
        newValue: parsed.data,
      },
    });

    return NextResponse.json({
      ...hotel,
      complimentaryReasons:
        complimentaryReasons ??
        parseComplimentaryReasons(hotel.posSettings),
      inventorySettings: parseInventorySettings(hotel.inventorySettings),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
