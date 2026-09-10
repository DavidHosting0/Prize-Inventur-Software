import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { getUserPermissions, type SessionUser } from "./rbac";
import type { AccountType } from "@prize/types";

const MOBILE_AUD = "prize-mobile";
const TOKEN_TTL = "30d";

function getAuthSecretKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signMobileAccessToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    hotelId: user.hotelId,
    hotelSlug: user.hotelSlug,
    roleCode: user.roleCode,
    accountType: user.accountType,
    organizationId: user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience(MOBILE_AUD)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getAuthSecretKey());
}

export async function verifyMobileToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      audience: MOBILE_AUD,
    });

    const userId = String(payload.sub ?? "");
    const hotelId = payload.hotelId ? String(payload.hotelId) : null;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        hotels: {
          include: { hotel: true },
          orderBy: { isDefault: "desc" },
        },
      },
    });

    if (!user || !user.isActive) return null;

    const permissions = await getUserPermissions(user.id);
    const accountType = user.accountType as AccountType;

    if (accountType === "HOTEL") {
      const hotelLink =
        user.hotels.find((h) => h.hotelId === hotelId) ?? user.hotels[0];
      if (!hotelLink) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roleCode: user.role.code,
        accountType,
        organizationId: user.organizationId,
        hotelId: hotelLink.hotelId,
        hotelSlug: hotelLink.hotel.slug,
        permissions,
        locale: user.locale,
        currency: hotelLink.hotel.currency,
        hotelLocale: hotelLink.hotel.locale,
        hotelName: hotelLink.hotel.name,
      };
    }

    // GROUP mobile: require hotel context for ops
    if (hotelId) {
      const hotel = await prisma.hotel.findFirst({
        where: { id: hotelId, organizationId: user.organizationId },
      });
      if (!hotel) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roleCode: user.role.code,
        accountType,
        organizationId: user.organizationId,
        hotelId: hotel.id,
        hotelSlug: hotel.slug,
        permissions,
        locale: user.locale,
        currency: hotel.currency,
        hotelLocale: hotel.locale,
        hotelName: hotel.name,
      };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      roleCode: user.role.code,
      accountType,
      organizationId: user.organizationId,
      hotelId: null,
      hotelSlug: null,
      permissions,
      locale: user.locale,
      currency: "CHF",
      hotelLocale: "de-CH",
      hotelName: "",
    };
  } catch {
    return null;
  }
}

export function toPublicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    roleCode: user.roleCode,
    accountType: user.accountType,
    organizationId: user.organizationId,
    hotelId: user.hotelId,
    hotelSlug: user.hotelSlug,
    permissions: user.permissions,
    locale: user.locale,
    currency: user.currency,
    hotelLocale: user.hotelLocale,
    hotelName: user.hotelName,
  };
}
