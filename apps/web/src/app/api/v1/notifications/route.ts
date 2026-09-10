import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "dashboard.view");

    // GROUP org mode has no hotel notifications
    if (!user.hotelId) {
      const { searchParams } = new URL(req.url);
      if (searchParams.get("count") === "1") {
        return NextResponse.json({ unreadCount: 0 });
      }
      return NextResponse.json({ items: [], unreadCount: 0 });
    }

    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const countOnly = searchParams.get("count") === "1";

    const unreadCount = await prisma.notification.count({
      where: { hotelId: hotelId, isRead: false },
    });

    if (countOnly) {
      return NextResponse.json({ unreadCount });
    }

    const items = await prisma.notification.findMany({
      where: {
        hotelId: hotelId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ items, unreadCount });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const markSchema = z.object({
  ids: z.array(z.string().cuid()).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "dashboard.view");
    const { hotelId } = await requireHotelContext(user);

    const parsed = markSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    if (parsed.data.all) {
      await prisma.notification.updateMany({
        where: { hotelId: hotelId, isRead: false },
        data: { isRead: true },
      });
    } else if (parsed.data.ids?.length) {
      await prisma.notification.updateMany({
        where: { hotelId: hotelId, id: { in: parsed.data.ids } },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
