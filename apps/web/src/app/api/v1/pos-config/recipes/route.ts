import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import {
  createRecipe,
  recipeCostSummary,
} from "@/lib/recipes";
import { createPosArticleFromRecipe } from "@/lib/pos-config";
import { posRecipeCreateSchema } from "@prize/validators";
import { recipeLineCost } from "@/lib/liquid-stock";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.view");
    const { hotelId } = await requireHotelContext(user);
    const items = await prisma.recipe.findMany({
      where: { hotelId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        posArticles: { select: { id: true, salePrice: true, isActive: true } },
      },
    });
    return NextResponse.json({
      items: items.map((r) => {
        const foodCost = r.items.reduce(
          (s: number, i) =>
            s +
            recipeLineCost(
              {
                trackLiquid: i.product.trackLiquid,
                bottleContentMl: i.product.bottleContentMl,
                purchasePrice: i.product.purchasePrice,
              },
              i.quantity,
              i.unit
            ),
          0
        );
        const sale = r.posArticles.find((a) => a.isActive);
        const salePrice = sale ? Number(sale.salePrice) : null;
        return {
          ...r,
          foodCost,
          salePrice,
          foodCostPct:
            salePrice && salePrice > 0 ? (foodCost / salePrice) * 100 : null,
          margin: salePrice != null ? salePrice - foodCost : null,
          posArticleId: sale?.id ?? r.posArticles[0]?.id ?? null,
        };
      }),
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
    assertPermission(user, "pos_config.manage_recipes");
    const { hotelId } = await requireHotelContext(user);
    const parsed = posRecipeCreateSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);
    const recipe = await createRecipe(user, {
      name: parsed.data.name,
      items: parsed.data.items,
      instructions: parsed.data.instructions,
    });
    let article = null;
    if (parsed.data.createPosArticle && parsed.data.salePrice != null) {
      article = await createPosArticleFromRecipe(user, {
        recipeId: recipe.id,
        name: parsed.data.name,
        salePrice: parsed.data.salePrice,
        vatRate: parsed.data.vatRate,
        posCategoryId: parsed.data.posCategoryId,
      });
    }
    const summary = await recipeCostSummary(hotelId, recipe.id);
    return NextResponse.json({ recipe, article, summary }, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
