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
import {
  createPurchaseOrder,
  getOrderSuggestions,
  submitPurchaseOrder,
} from "@/lib/purchasing";

const createPoSchema = z.object({
  supplierId: z.string().cuid(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantityOrdered: z.coerce.number().positive(),
        unitPrice: z.coerce.number().nonnegative(),
      })
    )
    .min(1),
});

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "orders.view");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    if (searchParams.get("suggestions") === "1") {
      const suggestions = await getOrderSuggestions(user);
      return NextResponse.json({ suggestions });
    }

    const items = await prisma.purchaseOrder.findMany({
      where: { hotelId: hotelId },
      include: {
        supplier: true,
        items: { include: { product: true } },
        _count: { select: { items: true } },
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

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "orders.create");
    await requireHotelContext(user);

    const body = await req.json();
    if (body.action === "submit" && body.id) {
      assertPermission(user, "orders.approve");
      const po = await submitPurchaseOrder(user, body.id);
      return NextResponse.json(po);
    }

    const parsed = createPoSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const po = await createPurchaseOrder(user, parsed.data);
    return NextResponse.json(po, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
