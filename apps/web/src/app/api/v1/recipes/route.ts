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
import { UNITS } from "@prize/types";
import {
  createRecipe,
  theoreticalConsumption,
  versionRecipe,
} from "@/lib/recipes";

const itemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  unit: z.enum(UNITS),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "recipes.view");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const recipeId = searchParams.get("id");
    const servings = Number(searchParams.get("servings") ?? 0);

    if (recipeId && servings > 0) {
      const lines = await theoreticalConsumption(
        hotelId,
        recipeId,
        servings
      );
      return NextResponse.json({ lines });
    }

    const items = await prisma.recipe.findMany({
      where: { hotelId },
      select: {
        id: true,
        name: true,
        version: true,
        isActive: true,
        items: {
          select: {
            quantity: true,
            unit: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "recipes.manage");
    await requireHotelContext(user);

    const body = await req.json();
    if (body.action === "version" && body.recipeId) {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      const recipe = await versionRecipe(user, body.recipeId, parsed.data);
      return NextResponse.json(recipe, { status: 201 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const recipe = await createRecipe(user, parsed.data);
    return NextResponse.json(recipe, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
