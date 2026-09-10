import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { saveHotelCoverImage } from "@/lib/hotel-image";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "hotels.manage");

    const { id } = await ctx.params;
    const hotel = await prisma.hotel.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!hotel) return jsonError("Not found", 404);

    const form = await req.formData();
    const file = form.get("file") ?? form.get("image");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("file required", 400);
    }

    let imageUrl: string;
    try {
      imageUrl = await saveHotelCoverImage(id, file);
    } catch (err) {
      if (err instanceof Error && err.message === "MAX_SIZE") {
        return jsonError("Max 5MB", 400);
      }
      if (err instanceof Error && err.message === "INVALID_TYPE") {
        return jsonError("Only JPEG/PNG/WebP", 400);
      }
      throw err;
    }

    const updated = await prisma.hotel.update({
      where: { id },
      data: { imageUrl },
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      hotelId: id,
      userId: user.id,
      accountType: user.accountType,
      action: "hotel.image",
      entity: "Hotel",
      entityId: id,
      newValue: { imageUrl },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
