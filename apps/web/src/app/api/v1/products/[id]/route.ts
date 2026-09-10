import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { productUpdateSchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.view");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const product = await prisma.product.findFirst({
      where: { id, hotelId: hotelId },
      include: { category: true, stockLevels: { include: { warehouse: true } } },
    });
    if (!product) return jsonError("Not found", 404);
    return NextResponse.json(product);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.edit");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const existing = await prisma.product.findFirst({
      where: { id, hotelId: hotelId },
    });
    if (!existing) return jsonError("Not found", 404);

    const body = await req.json();
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        400,
        "VALIDATION"
      );
    }

    const data = { ...parsed.data };
    const trackLiquid =
      data.trackLiquid !== undefined ? data.trackLiquid : existing.trackLiquid;
    const bottleContentMl =
      data.bottleContentMl !== undefined
        ? data.bottleContentMl
        : existing.bottleContentMl
          ? Number(existing.bottleContentMl)
          : null;

    if (trackLiquid && !(bottleContentMl != null && bottleContentMl > 0)) {
      return jsonError(
        "bottleContentMl required when trackLiquid",
        400,
        "VALIDATION"
      );
    }

    if (trackLiquid) {
      data.unit = "ML";
      data.trackLiquid = true;
      data.bottleContentMl = bottleContentMl;
    } else if (data.trackLiquid === false) {
      data.bottleContentMl = null;
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "product.update",
      entity: "Product",
      entityId: id,
      oldValue: existing,
      newValue: product,
    });

    return NextResponse.json(product);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.delete");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const existing = await prisma.product.findFirst({
      where: { id, hotelId: hotelId },
    });
    if (!existing) return jsonError("Not found", 404);

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "product.deactivate",
      entity: "Product",
      entityId: id,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: false },
    });

    return NextResponse.json(product);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
