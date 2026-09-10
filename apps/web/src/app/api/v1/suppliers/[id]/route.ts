import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { supplierSchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "suppliers.manage");
    const { hotelId } = await requireHotelContext(user);

    const { id } = await ctx.params;
    const existing = await prisma.supplier.findFirst({
      where: { id, hotelId: hotelId },
    });
    if (!existing) return jsonError("Not found", 404);

    const parsed = supplierSchema.partial().safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const data = { ...parsed.data };
    if (data.email === "") data.email = null;

    const item = await prisma.supplier.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "supplier.update",
      entity: "Supplier",
      entityId: item.id,
      newValue: data,
    });

    return NextResponse.json(item);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
