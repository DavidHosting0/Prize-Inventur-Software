import { auth } from "./auth";
import type { SessionUser } from "./rbac";
import type { Permission } from "@prize/types";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyMobileToken } from "./mobile-auth";
import { isAdminRole } from "./tenant";
import { prisma } from "./db";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (session?.user?.id) {
    const user = session.user as SessionUser;
    // Incomplete JWT (legacy / reseed): verify the user still exists.
    // Happy path trusts the signed session — avoids a DB round-trip on every API call.
    if (!user.organizationId || !user.accountType) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true },
      });
      if (!dbUser) return null;
    }
    return user;
  }

  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      return verifyMobileToken(token);
    }
  }

  return null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function assertPermission(user: SessionUser, permission: Permission) {
  if (isAdminRole(user.roleCode)) return;
  if (!user.permissions.includes(permission)) {
    throw NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
