import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { getHotelInventorySettings } from "@/lib/inventory-settings";
import { DEFAULT_INVENTORY_SETTINGS } from "@prize/types";

/** Lightweight read for inventory staff (no settings.manage required). */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "inventory.view");
    const { hotelId } = await requireHotelContext(user);
    const inventorySettings = await getHotelInventorySettings(hotelId);
    return NextResponse.json({
      inventorySettings,
      defaultInventorySettings: DEFAULT_INVENTORY_SETTINGS,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
