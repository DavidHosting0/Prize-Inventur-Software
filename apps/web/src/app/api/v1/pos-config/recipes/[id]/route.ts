import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import {
  duplicateRecipe,
  recipeCostSummary,
  updateRecipeInPlace,
} from "@/lib/recipes";
import { posRecipeUpdateSchema } from "@prize/validators";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.view");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const summary = await recipeCostSummary(hotelId, id);
    return NextResponse.json(summary);
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
    assertPermission(user, "pos_config.manage_recipes");
    const { hotelId } = await requireHotelContext(user);
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.action === "duplicate") {
      const recipe = await duplicateRecipe(user, id);
      return NextResponse.json(recipe, { status: 201 });
    }
    const parsed = posRecipeUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const recipe = await updateRecipeInPlace(user, id, parsed.data);
    const summary = await recipeCostSummary(hotelId, recipe.id);
    return NextResponse.json(summary);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
