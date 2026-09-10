import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import {
  createPosArticleFromProduct,
  createPosArticleFromRecipe,
  listPosArticles,
  reorderPosArticles,
} from "@/lib/pos-config";
import {
  posArticleCreateFromProductSchema,
  posArticleCreateFromRecipeSchema,
  posArticleReorderSchema,
} from "@prize/validators";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.view");
    await requireHotelContext(user);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const activeParam = searchParams.get("active");
    const items = await listPosArticles(user, {
      q: searchParams.get("q") ?? undefined,
      type:
        type === "PRODUCT" || type === "RECIPE"
          ? type
          : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      active:
        activeParam === null
          ? undefined
          : activeParam === "1" || activeParam === "true",
    });
    return NextResponse.json({
      items: items.map((a) => ({
        ...a,
        salePrice: a.salePrice.toString(),
        vatRate: a.vatRate.toString(),
      })),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    await requireHotelContext(user);
    const body = await req.json();

    if (body.action === "reorder") {
      assertPermission(user, "pos_config.manage_layout");
      const parsed = posArticleReorderSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      const items = await reorderPosArticles(user, parsed.data.orderedIds);
      return NextResponse.json({ items });
    }

    assertPermission(user, "pos_config.create");

    if (body.source === "recipe" || body.recipeId) {
      const parsed = posArticleCreateFromRecipeSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      const row = await createPosArticleFromRecipe(user, parsed.data);
      return NextResponse.json(row, { status: 201 });
    }

    const parsed = posArticleCreateFromProductSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const row = await createPosArticleFromProduct(user, parsed.data);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
