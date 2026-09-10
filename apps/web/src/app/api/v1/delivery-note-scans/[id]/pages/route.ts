import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import {
  addDeliveryNotePage,
  getDeliveryNoteScan,
} from "@/lib/delivery-note-scans";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.create");
    await requireHotelContext(user);

    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("file required", 400);

    await addDeliveryNotePage(user, id, file);
    const scan = await getDeliveryNoteScan(user, id);
    return NextResponse.json(scan, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) {
      const status =
        e.message === "SCAN_NOT_FOUND"
          ? 404
          : e.message === "INVALID_IMAGE_TYPE" || e.message === "IMAGE_TOO_LARGE"
            ? 400
            : 400;
      return jsonError(e.message, status);
    }
    return jsonError("Server error", 500);
  }
}
