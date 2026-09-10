import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "permissions.view");

    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ scope: "asc" }, { code: "asc" }],
    });

    const permissions = await prisma.permission.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        scope: r.scope,
        description: r.description,
        userCount: r._count.users,
        permissions: r.permissions.map((rp) => rp.permission.code),
      })),
      permissions,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
