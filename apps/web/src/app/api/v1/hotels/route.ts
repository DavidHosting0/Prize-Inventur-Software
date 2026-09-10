import { NextResponse } from "next/server";
import {
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  assertHotelAccess,
  canViewAllHotels,
  getAccessibleHotelIds,
} from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);

    if (user.accountType === "HOTEL") {
      const links = await prisma.userHotel.findMany({
        where: { userId: user.id },
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              slug: true,
              currency: true,
              locale: true,
              city: true,
            },
          },
        },
        orderBy: { isDefault: "desc" },
      });

      return NextResponse.json({
        currentHotelId: user.hotelId,
        accountType: user.accountType,
        canSwitch: false,
        hotels: links.map((l) => ({
          id: l.hotel.id,
          name: l.hotel.name,
          slug: l.hotel.slug,
          currency: l.hotel.currency,
          locale: l.hotel.locale,
          city: l.hotel.city,
          isDefault: l.isDefault,
        })),
      });
    }

    // GROUP: accessible hotels in org
    const accessibleIds = await getAccessibleHotelIds(user);
    const hotels = await prisma.hotel.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: accessibleIds },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        locale: true,
        city: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      currentHotelId: user.hotelId,
      accountType: user.accountType,
      canSwitch: true,
      canClearContext: true,
      hotels: hotels.map((h) => ({
        id: h.id,
        name: h.name,
        slug: h.slug,
        currency: h.currency,
        locale: h.locale,
        city: h.city,
        isDefault: false,
      })),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const switchSchema = z.object({
  hotelId: z.string().cuid().nullable(),
});

/**
 * Enter or clear hotel context.
 * HOTEL accounts cannot switch (403).
 * GROUP: set hotelId to enter hotel, or null to return to group mode.
 * Client must call `session.update({ hotelId })` afterward.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);

    const parsed = switchSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    // Clear context — GROUP only
    if (parsed.data.hotelId === null) {
      if (user.accountType !== "GROUP") {
        return jsonError("Hotel accounts cannot clear hotel context", 403, "HOTEL_FORBIDDEN");
      }
      return NextResponse.json({
        hotelId: null,
        slug: null,
        hotelName: "",
        currency: "CHF",
        hotelLocale: "de-CH",
      });
    }

    if (user.accountType === "HOTEL") {
      if (user.hotelId !== parsed.data.hotelId) {
        await writeAuditLog({
          organizationId: user.organizationId,
          hotelId: user.hotelId,
          userId: user.id,
          accountType: user.accountType,
          action: "authz.hotel_forbidden",
          entity: "Hotel",
          entityId: parsed.data.hotelId,
          newValue: { attemptedHotelId: parsed.data.hotelId },
        });
        return jsonError("Hotel accounts cannot switch hotels", 403, "HOTEL_FORBIDDEN");
      }
      const hotel = await prisma.hotel.findUnique({ where: { id: user.hotelId! } });
      if (!hotel) return jsonError("Hotel not found", 404);
      return NextResponse.json({
        hotelId: hotel.id,
        slug: hotel.slug,
        hotelName: hotel.name,
        currency: hotel.currency,
        hotelLocale: hotel.locale,
      });
    }

    try {
      await assertHotelAccess(user, parsed.data.hotelId);
    } catch (e) {
      if (isNextResponse(e)) {
        await writeAuditLog({
          organizationId: user.organizationId,
          userId: user.id,
          accountType: user.accountType,
          action: "authz.hotel_forbidden",
          entity: "Hotel",
          entityId: parsed.data.hotelId,
        });
        return e;
      }
      throw e;
    }

    const hotel = await prisma.hotel.findFirst({
      where: {
        id: parsed.data.hotelId,
        organizationId: user.organizationId,
      },
    });
    if (!hotel) return jsonError("Hotel not assigned to user", 403, "HOTEL_FORBIDDEN");

    // Persist default for allow-listed membership when present
    if (!canViewAllHotels(user)) {
      await prisma.userHotel.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
      await prisma.userHotel.update({
        where: {
          userId_hotelId: { userId: user.id, hotelId: hotel.id },
        },
        data: { isDefault: true },
      });
    }

    return NextResponse.json({
      hotelId: hotel.id,
      slug: hotel.slug,
      hotelName: hotel.name,
      currency: hotel.currency,
      hotelLocale: hotel.locale,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
