import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "stock.view");
    const { hotelId } = await requireHotelContext(user);

    const warehouses = await prisma.warehouse.findMany({
      where: { hotelId: hotelId, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ items: warehouses });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
