import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { loadPosBootstrap } from "@/lib/pos-bootstrap";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "pos.sell");
    const { hotelId } = await requireHotelContext(user);

    const canDiscount =
      user.roleCode === "ADMIN" || hasPermission(user, "pos.discount");
    const canCreateProduct =
      user.roleCode === "ADMIN" || hasPermission(user, "products.create");
    const bootstrap = await loadPosBootstrap(hotelId, {
      canDiscount,
      canCreateProduct,
    });
    return NextResponse.json(bootstrap);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
