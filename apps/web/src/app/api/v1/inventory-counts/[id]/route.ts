import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { inventoryCountItemSchema } from "@prize/validators";
import { closeInventoryCount, countInventoryItem } from "@/lib/inventory";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "inventory.view");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const count = await prisma.inventoryCount.findFirst({
      where: { id, hotelId: hotelId },
      include: {
        items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
        warehouse: true,
        createdBy: true,
      },
    });
    if (!count) return jsonError("Not found", 404);
    return NextResponse.json(count);
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
    const action = body.action as string;

    if (action === "count") {
      assertPermission(user, "inventory.edit");
      const parsed = inventoryCountItemSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      const item = await countInventoryItem(
        user,
        id,
        parsed.data.productId,
        parsed.data.countedQty
      );
      return NextResponse.json(item);
    }

    if (action === "close") {
      assertPermission(user, "inventory.close");
      const count = await closeInventoryCount(user, id);
      return NextResponse.json(count);
    }

    return jsonError("Unknown action", 400);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
