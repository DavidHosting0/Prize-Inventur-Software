import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "audit.view");

    const url = new URL(req.url);
    const hotelId = url.searchParams.get("hotelId");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        ...(hotelId ? { hotelId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        hotel: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ logs });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
