import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { createSaleSchema, paySaleSchema } from "@prize/validators";
import { cancelSale, createPendingSale, paySale, refundSale } from "@/lib/sales";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const items = await prisma.sale.findMany({
      where: {
        hotelId: hotelId,
        ...(status ? { status: status as "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "FAILED" } : {}),
      },
      include: { items: true, payments: true, cashier: true },
      orderBy: { createdAt: "desc" },
      take: 50,
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
    assertPermission(user, "pos.sell");
    await requireHotelContext(user);

    const parsed = createSaleSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const sale = await createPendingSale(user, parsed.data);
    return NextResponse.json(sale, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
