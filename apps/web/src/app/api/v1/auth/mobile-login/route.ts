import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserPermissions } from "@/lib/rbac";
import {
  signMobileAccessToken,
  toPublicUser,
} from "@/lib/mobile-auth";
import { jsonError } from "@/lib/api";
import type { SessionUser } from "@/lib/rbac";
import type { AccountType } from "@prize/types";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  hotelId: z.string().cuid().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError("Validation failed", 400, "VALIDATION");
    }

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;
    const requestedHotelId = parsed.data.hotelId;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        hotels: {
          include: { hotel: true },
          orderBy: { isDefault: "desc" },
        },
      },
    });

    if (!user || !user.isActive) {
      return jsonError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return jsonError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const permissions = await getUserPermissions(user.id);
    const dbUser = user as typeof user & {
      accountType: AccountType;
      organizationId: string;
    };
    const accountType = dbUser.accountType;

    let sessionUser: SessionUser;

    if (accountType === "HOTEL") {
      const hotelLink =
        (requestedHotelId
          ? user.hotels.find((h) => h.hotelId === requestedHotelId)
          : undefined) ?? user.hotels[0];
      if (!hotelLink) {
        return jsonError("No hotel assigned", 403, "NO_HOTEL");
      }

      sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roleCode: user.role.code,
        accountType,
        organizationId: dbUser.organizationId || hotelLink.hotel.organizationId,
        hotelId: hotelLink.hotelId,
        hotelSlug: hotelLink.hotel.slug,
        permissions,
        locale: user.locale,
        currency: hotelLink.hotel.currency,
        hotelLocale: hotelLink.hotel.locale,
        hotelName: hotelLink.hotel.name,
      };
    } else {
      // GROUP: require a hotel for mobile ops (explicit or default link)
      let hotel =
        requestedHotelId != null
          ? await prisma.hotel.findFirst({
              where: {
                id: requestedHotelId,
                organizationId: dbUser.organizationId,
              },
            })
          : null;

      if (!hotel && user.hotels[0]) {
        hotel = user.hotels[0].hotel;
      }

      if (!hotel) {
        return jsonError(
          "Select a hotel context first",
          403,
          "HOTEL_CONTEXT_REQUIRED"
        );
      }

      sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roleCode: user.role.code,
        accountType,
        organizationId: dbUser.organizationId || hotel.organizationId,
        hotelId: hotel.id,
        hotelSlug: hotel.slug,
        permissions,
        locale: user.locale,
        currency: hotel.currency,
        hotelLocale: hotel.locale,
        hotelName: hotel.name,
      };
    }

    const accessToken = await signMobileAccessToken(sessionUser);

    return NextResponse.json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: "30d",
      user: toPublicUser(sessionUser),
    });
  } catch (e) {
    console.error("[mobile-login]", e);
    return jsonError("Server error", 500);
  }
}
