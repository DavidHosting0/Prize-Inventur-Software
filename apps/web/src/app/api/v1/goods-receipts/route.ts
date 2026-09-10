import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { createGoodsReceiptSchema } from "@prize/validators";
import { createGoodsReceipt } from "@/lib/goods-receipts";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.view");
    const { hotelId } = await requireHotelContext(user);

    const items = await prisma.goodsReceipt.findMany({
      where: { hotelId: hotelId },
      include: {
        supplier: true,
        warehouse: true,
        deliveryNoteScan: {
          select: {
            id: true,
            documentHash: true,
            pages: {
              select: { id: true, pageIndex: true, imageUrl: true },
              orderBy: { pageIndex: "asc" },
              take: 1,
            },
          },
        },
        _count: { select: { items: true } },
      },
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
    assertPermission(user, "receiving.create");
    await requireHotelContext(user);

    const parsed = createGoodsReceiptSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError("Validation failed", 400, "VALIDATION");
    }

    const receipt = await createGoodsReceipt(user, parsed.data);
    return NextResponse.json(receipt, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
