import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { confirmDeliveryNoteScan } from "@/lib/delivery-note-scans";
import { confirmDeliveryNoteScanSchema } from "@prize/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "receiving.confirm");
    await requireHotelContext(user);

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = confirmDeliveryNoteScanSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Validation failed", 400, "VALIDATION");
    }

    try {
      const scan = await confirmDeliveryNoteScan(user, id, parsed.data);
      return NextResponse.json(scan);
    } catch (e) {
      if (e instanceof Error && e.message === "DUPLICATE_DELIVERY_NOTE") {
        const duplicates =
          (e as Error & { duplicates?: unknown }).duplicates ?? [];
        return NextResponse.json(
          {
            error: "DUPLICATE_DELIVERY_NOTE",
            code: "DUPLICATE_DELIVERY_NOTE",
            duplicates,
          },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400, e.message);
    return jsonError("Server error", 500);
  }
}
