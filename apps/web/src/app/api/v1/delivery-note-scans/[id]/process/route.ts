import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { processDeliveryNoteScan } from "@/lib/delivery-note-scans";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.create");
    await requireHotelContext(user);

    const { id } = await ctx.params;
    const result = await processDeliveryNoteScan(user, id);
    return NextResponse.json(result);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) {
      const code = e.message;
      const status =
        code === "SCAN_NOT_FOUND"
          ? 404
          : code === "OCR_NOT_CONFIGURED"
            ? 503
            : 400;
      return jsonError(code, status, code);
    }
    return jsonError("Server error", 500);
  }
}
