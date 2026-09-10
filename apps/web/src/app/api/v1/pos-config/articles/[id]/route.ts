import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { getPosArticle, updatePosArticle } from "@/lib/pos-config";
import { posArticleUpdateSchema } from "@prize/validators";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.view");
    await requireHotelContext(user);
    const { id } = await ctx.params;
    const row = await getPosArticle(user, id);
    return NextResponse.json({
      ...row,
      salePrice: row.salePrice.toString(),
      vatRate: row.vatRate.toString(),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
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
    await requireHotelContext(user);
    const body = await req.json();
    if (body.salePrice !== undefined) {
      assertPermission(user, "pos_config.manage_prices");
    } else {
      assertPermission(user, "pos_config.edit");
    }
    const { id } = await ctx.params;
    const parsed = posArticleUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const row = await updatePosArticle(user, id, parsed.data);
    return NextResponse.json({
      ...row,
      salePrice: row.salePrice.toString(),
      vatRate: row.vatRate.toString(),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
