import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { createDeliveryNoteScan } from "@/lib/delivery-note-scans";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.view");
    const { hotelId } = await requireHotelContext(user);

    const items = await prisma.deliveryNoteScan.findMany({
      where: { hotelId: hotelId },
      include: {
        supplier: true,
        pages: { select: { id: true, pageIndex: true, imageUrl: true } },
        goodsReceipt: { select: { id: true, status: true, deliveryNoteNo: true } },
        _count: { select: { pages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.create");
    await requireHotelContext(user);

    const scan = await createDeliveryNoteScan(user);
    return NextResponse.json(scan, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
