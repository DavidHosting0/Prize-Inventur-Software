import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { loadPosBootstrap } from "@/lib/pos-bootstrap";

/** @deprecated Prefer /api/v1/pos/bootstrap — kept for compatibility. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);

    const { products } = await loadPosBootstrap(hotelId);
    return NextResponse.json({ items: products });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
