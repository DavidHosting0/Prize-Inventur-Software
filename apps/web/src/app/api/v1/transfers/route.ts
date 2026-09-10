import { NextResponse } from "next/server";
import {
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";

/**
 * Stock transfers between warehouses are disabled — each hotel has one Lager.
 * Historical transfer records remain in the database for audit.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    await requireHotelContext(user);
    return jsonError(
      "Lagertransfers sind deaktiviert — es gibt nur ein zentrales Lager.",
      410,
      "TRANSFERS_DISABLED"
    );
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    await requireHotelContext(user);
    return jsonError(
      "Lagertransfers sind deaktiviert — es gibt nur ein zentrales Lager.",
      410,
      "TRANSFERS_DISABLED"
    );
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
