import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { deletePosCategory, updatePosCategory } from "@/lib/pos-config";
import { posCategorySchema } from "@prize/validators";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.manage_categories");
    await requireHotelContext(user);
    const { id } = await ctx.params;
    const parsed = posCategorySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);
    const row = await updatePosCategory(user, id, parsed.data);
    return NextResponse.json(row);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
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
    assertPermission(user, "pos_config.delete");
    await requireHotelContext(user);
    const { id } = await ctx.params;
    const row = await deletePosCategory(user, id);
    return NextResponse.json(row);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
