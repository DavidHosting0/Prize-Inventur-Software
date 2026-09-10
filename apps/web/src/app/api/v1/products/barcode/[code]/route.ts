import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { findProductByBarcode, normalizeBarcode } from "@/lib/barcode";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.view");
    const { hotelId } = await requireHotelContext(user);

    const { code: raw } = await ctx.params;
    const code = normalizeBarcode(decodeURIComponent(raw));
    if (!code) return jsonError("Artikel nicht gefunden", 404, "BARCODE_UNKNOWN");

    const product = await findProductByBarcode(hotelId, code);

    if (!product) return jsonError("Artikel nicht gefunden", 404, "BARCODE_UNKNOWN");
    if (!product.isActive) return jsonError("Produkt deaktiviert", 400, "PRODUCT_INACTIVE");

    return NextResponse.json(product);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
