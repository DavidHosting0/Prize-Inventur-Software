import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { confirmGoodsReceipt } from "@/lib/goods-receipts";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.view");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const receipt = await prisma.goodsReceipt.findFirst({
      where: { id, hotelId: hotelId },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
        deliveryNoteScan: {
          include: {
            pages: { orderBy: { pageIndex: "asc" } },
          },
        },
      },
    });
    if (!receipt) return jsonError("Not found", 404);
    return NextResponse.json(receipt);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    await requireHotelContext(user);
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.action !== "confirm") return jsonError("Unknown action", 400);

    assertPermission(user, "receiving.confirm");
    const receipt = await confirmGoodsReceipt(user, id);
    return NextResponse.json(receipt);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
