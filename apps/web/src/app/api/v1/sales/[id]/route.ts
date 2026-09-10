import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { paySaleSchema } from "@prize/validators";
import { cancelSale, paySale, refundSale } from "@/lib/sales";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const sale = await prisma.sale.findFirst({
      where: { id, hotelId },
      include: {
        items: { include: { product: true } },
        payments: true,
        cashier: true,
        warehouse: true,
      },
    });
    if (!sale) return jsonError("Not found", 404);
    return NextResponse.json(sale);
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

    if (action === "pay") {
      assertPermission(user, "pos.sell");
      const parsed = paySaleSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      try {
        const sale = await paySale(user, id, parsed.data);
        return NextResponse.json(sale);
      } catch (err) {
        if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
          await prisma.sale.update({
            where: { id },
            data: { status: "FAILED" },
          });
          return jsonError("Nicht genügend Bestand", 400, "INSUFFICIENT_STOCK");
        }
        throw err;
      }
    }

    if (action === "cancel") {
      assertPermission(user, "pos.cancel");
      const sale = await cancelSale(user, id);
      return NextResponse.json(sale);
    }

    if (action === "refund") {
      assertPermission(user, "pos.refund");
      const sale = await refundSale(user, id, body.reason);
      return NextResponse.json(sale);
    }

    return jsonError("Unknown action", 400);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
