import type { AccountType, Permission } from "@prize/types";
import { isAdminRole } from "./tenant";
import { prisma } from "./db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  roleCode: string;
  accountType: AccountType;
  organizationId: string;
  hotelId: string | null;
  /** URL slug of active hotel, e.g. "bern" */
  hotelSlug: string | null;
  permissions: Permission[];
  locale: string;
  currency: string;
  hotelLocale: string;
  hotelName: string;
};

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });
  if (!user) return [];
  return user.role.permissions.map((rp) => rp.permission.code as Permission);
}

export function hasPermission(
  user: { permissions: string[]; roleCode?: string },
  permission: Permission
) {
  if (user.roleCode && isAdminRole(user.roleCode)) return true;
  return user.permissions.includes(permission);
}

export async function requirePermission(
  user: SessionUser,
  permission: Permission
) {
  if (!hasPermission(user, permission)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
