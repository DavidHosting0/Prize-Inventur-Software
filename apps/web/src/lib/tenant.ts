import type { AccountType, Permission } from "@prize/types";
import { ADMIN_ROLE_CODES } from "@prize/types";
import { NextResponse } from "next/server";
import { prisma } from "./db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  roleCode: string;
  accountType: AccountType;
  organizationId: string;
  /** Active hotel; null when a GROUP user is in organization mode */
  hotelId: string | null;
  /** URL slug of active hotel, e.g. "bern" */
  hotelSlug: string | null;
  permissions: Permission[];
  locale: string;
  currency: string;
  hotelLocale: string;
  hotelName: string;
};

export type TenantContext = {
  userId: string;
  organizationId: string;
  accountType: AccountType;
  hotelId: string | null;
  permissions: Permission[];
  roleCode: string;
};

export function getTenantContext(user: SessionUser): TenantContext {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    accountType: user.accountType,
    hotelId: user.hotelId,
    permissions: user.permissions,
    roleCode: user.roleCode,
  };
}

export function isAdminRole(roleCode: string): boolean {
  return (ADMIN_ROLE_CODES as readonly string[]).includes(roleCode);
}

/** Whether the user has hotels.view_all / GROUP_ADMIN style all-hotel access */
export function canViewAllHotels(user: SessionUser): boolean {
  if (user.accountType !== "GROUP") return false;
  if (isAdminRole(user.roleCode)) return true;
  return (
    user.permissions.includes("hotels.view_all") ||
    user.permissions.includes("analytics.view_all_hotels")
  );
}

export async function getAccessibleHotelIds(user: SessionUser): Promise<string[]> {
  if (user.accountType === "HOTEL") {
    if (!user.hotelId) return [];
    return [user.hotelId];
  }

  if (canViewAllHotels(user)) {
    const hotels = await prisma.hotel.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    return hotels.map((h) => h.id);
  }

  const links = await prisma.userHotel.findMany({
    where: {
      userId: user.id,
      hotel: { organizationId: user.organizationId },
    },
    select: { hotelId: true },
  });
  return links.map((l) => l.hotelId);
}

/**
 * Assert the user may access the given hotel. Throws NextResponse 403 on failure.
 */
export async function assertHotelAccess(
  user: SessionUser,
  hotelId: string
): Promise<void> {
  const accountType = user.accountType ?? "HOTEL";

  if (accountType === "HOTEL") {
    if (!user.hotelId || user.hotelId !== hotelId) {
      throw NextResponse.json(
        { error: "Forbidden", code: "HOTEL_FORBIDDEN" },
        { status: 403 }
      );
    }
    return;
  }

  // GROUP: hotel must belong to same org and be accessible
  if (!user.organizationId) {
    throw NextResponse.json(
      { error: "Forbidden", code: "HOTEL_FORBIDDEN" },
      { status: 403 }
    );
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!hotel) {
    throw NextResponse.json(
      { error: "Forbidden", code: "HOTEL_FORBIDDEN" },
      { status: 403 }
    );
  }

  if (canViewAllHotels({ ...user, accountType })) return;

  const link = await prisma.userHotel.findFirst({
    where: { userId: user.id, hotelId },
  });
  if (!link) {
    throw NextResponse.json(
      { error: "Forbidden", code: "HOTEL_FORBIDDEN" },
      { status: 403 }
    );
  }
}

/**
 * Resolve the active hotel for hotel-scoped operations.
 * HOTEL accounts always use their assigned hotel.
 * GROUP accounts require a non-null active hotelId that they can access.
 */
export async function requireHotelContext(
  user: SessionUser
): Promise<{ hotelId: string; organizationId: string }> {
  const accountType = user.accountType ?? "HOTEL";

  if (accountType === "HOTEL") {
    // Happy path: trust signed JWT hotel + org (no extra DB lookups).
    if (user.hotelId && user.organizationId) {
      return { hotelId: user.hotelId, organizationId: user.organizationId };
    }

    // Heal stale / incomplete sessions (e.g. after reseed).
    let hotelId = user.hotelId;
    const preferred = hotelId
      ? await prisma.userHotel.findFirst({
          where: { userId: user.id, hotelId },
        })
      : null;
    if (!preferred) {
      const fallback = await prisma.userHotel.findFirst({
        where: { userId: user.id },
        orderBy: { isDefault: "desc" },
      });
      hotelId = fallback?.hotelId ?? null;
    }
    if (!hotelId) {
      throw NextResponse.json(
        { error: "No hotel assigned", code: "HOTEL_REQUIRED" },
        { status: 403 }
      );
    }
    const organizationId =
      user.organizationId ||
      (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { organizationId: true },
        })
      )?.organizationId;
    if (!organizationId) {
      throw NextResponse.json(
        { error: "Forbidden", code: "HOTEL_FORBIDDEN" },
        { status: 403 }
      );
    }
    return { hotelId, organizationId };
  }

  if (!user.hotelId) {
    throw NextResponse.json(
      {
        error: "Select a hotel context first",
        code: "HOTEL_CONTEXT_REQUIRED",
      },
      { status: 403 }
    );
  }

  await assertHotelAccess({ ...user, accountType }, user.hotelId);
  return {
    hotelId: user.hotelId,
    organizationId: user.organizationId,
  };
}

export function requireGroupAccount(user: SessionUser): void {
  if (user.accountType !== "GROUP") {
    throw NextResponse.json(
      { error: "Forbidden", code: "GROUP_ONLY" },
      { status: 403 }
    );
  }
}

/** Narrow SessionUser.hotelId for domain helpers after route-level requireHotelContext. */
export function assertSessionHotelId(
  user: SessionUser
): asserts user is SessionUser & { hotelId: string } {
  if (!user.hotelId) {
    throw new Error("HOTEL_REQUIRED");
  }
}
