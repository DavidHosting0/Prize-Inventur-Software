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
import { recordWaste, WASTE_REASONS } from "@/lib/waste";

const createWasteSchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid().optional(),
  quantity: z.coerce.number().positive(),
  reason: z.enum(WASTE_REASONS),
});

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "waste.view");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const items = await prisma.waste.findMany({
      where: {
        hotelId: hotelId,
        ...(from ? { createdAt: { gte: new Date(from) } } : {}),
      },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "waste.create");
    await requireHotelContext(user);

    const parsed = createWasteSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const waste = await recordWaste(user, parsed.data);
    return NextResponse.json(waste, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) {
      if (e.message === "INSUFFICIENT_STOCK") {
        return jsonError("Nicht genuegend Bestand", 400, "INSUFFICIENT_STOCK");
      }
      return jsonError(e.message, 400);
    }
    return jsonError("Server error", 500);
  }
}
