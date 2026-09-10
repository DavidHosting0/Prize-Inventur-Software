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
import { recordMinibarConsumption } from "@/lib/minibar";

const createSchema = z.object({
  roomNumber: z.string().min(1).max(32),
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "stock.view");
    const { hotelId } = await requireHotelContext(user);

    const room = new URL(req.url).searchParams.get("room");
    const items = await prisma.minibarRecord.findMany({
      where: {
        hotelId: hotelId,
        ...(room ? { roomNumber: room } : {}),
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
    assertPermission(user, "stock.adjust");
    await requireHotelContext(user);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const record = await recordMinibarConsumption(user, parsed.data);
    return NextResponse.json(record, { status: 201 });
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
