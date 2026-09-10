import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import {
  createPosCategory,
  listPosCategories,
  reorderPosCategories,
} from "@/lib/pos-config";
import {
  posCategoryReorderSchema,
  posCategorySchema,
} from "@prize/validators";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos_config.view");
    await requireHotelContext(user);
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") !== "0";
    const items = await listPosCategories(user, includeInactive);
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
    assertPermission(user, "pos_config.manage_categories");
    await requireHotelContext(user);
    const body = await req.json();
    if (body.action === "reorder") {
      const parsed = posCategoryReorderSchema.safeParse(body);
      if (!parsed.success) return jsonError("Validation failed", 400);
      const items = await reorderPosCategories(user, parsed.data.orderedIds);
      return NextResponse.json({ items });
    }
    const parsed = posCategorySchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    const row = await createPosCategory(user, parsed.data);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) {
      if (e.message.includes("Unique")) return jsonError("Name already exists", 400);
      return jsonError(e.message, 400);
    }
    return jsonError("Server error", 500);
  }
}
