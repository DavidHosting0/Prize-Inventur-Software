import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import {
  getDeliveryNoteScan,
  updateDeliveryNoteScan,
} from "@/lib/delivery-note-scans";
import { updateDeliveryNoteScanSchema } from "@prize/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.view");
    await requireHotelContext(user);

    const { id } = await ctx.params;
    const scan = await getDeliveryNoteScan(user, id);
    if (!scan) return jsonError("Not found", 404);
    return NextResponse.json(scan);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.create");
    await requireHotelContext(user);

    const { id } = await ctx.params;
    const parsed = updateDeliveryNoteScanSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError("Validation failed", 400, "VALIDATION");
    }

    const scan = await updateDeliveryNoteScan(user, id, parsed.data);
    return NextResponse.json(scan);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
