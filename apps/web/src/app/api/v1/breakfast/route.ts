import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getBreakfastForecast, upsertBreakfastRecord } from "@/lib/breakfast";

const upsertSchema = z.object({
  date: z.string().min(8),
  expectedGuests: z.coerce.number().int().nonnegative(),
  actualGuests: z.coerce.number().int().nonnegative(),
  costTotal: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "dashboard.view");
    const { hotelId } = await requireHotelContext(user);

    const [forecast, items] = await Promise.all([
      getBreakfastForecast(user),
      prisma.breakfastRecord.findMany({
        where: { hotelId: hotelId },
        orderBy: { date: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({ forecast, items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "inventory.edit");
    await requireHotelContext(user);

    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const record = await upsertBreakfastRecord(user, parsed.data);
    return NextResponse.json(record);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
