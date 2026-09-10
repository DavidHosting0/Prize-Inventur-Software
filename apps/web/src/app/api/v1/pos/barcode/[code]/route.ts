import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { resolvePosArticleByBarcode } from "@/lib/pos-bootstrap";
import { normalizeBarcode } from "@/lib/barcode";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);
    const { code: raw } = await ctx.params;
    const code = normalizeBarcode(decodeURIComponent(raw));
    if (!code) {
      return jsonError("Empty barcode", 400, "BARCODE_EMPTY");
    }

    const article = await resolvePosArticleByBarcode(hotelId, code);
    if (!article) {
      return jsonError("Not found", 404, "BARCODE_UNKNOWN");
    }
    if (!article.isActive) {
      return jsonError("Inactive", 404, "PRODUCT_INACTIVE");
    }
    return NextResponse.json(article);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
