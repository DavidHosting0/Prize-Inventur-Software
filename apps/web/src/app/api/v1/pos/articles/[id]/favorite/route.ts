import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Toggle PosArticle favorite from the till (BAR has pos.sell). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const article = await prisma.posArticle.findFirst({
      where: { id, hotelId, isActive: true },
    });
    if (!article) return jsonError("Not found", 404);

    const nextFavorite =
      typeof body.isFavorite === "boolean"
        ? body.isFavorite
        : !article.isFavorite;

    const updated = await prisma.posArticle.update({
      where: { id },
      data: { isFavorite: nextFavorite },
      select: {
        id: true,
        name: true,
        isFavorite: true,
      },
    });

    await writeAuditLog({
      hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "pos_article.favorite",
      entity: "PosArticle",
      entityId: id,
      newValue: { isFavorite: updated.isFavorite },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
