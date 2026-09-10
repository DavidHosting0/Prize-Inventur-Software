import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { getAccessibleHotelIds, requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { RESERVED_PATH_SEGMENTS, slugifyHotelName } from "@/lib/hotel-url";
import { provisionNewHotel } from "@/lib/hotel-provision";
import { saveHotelCoverImage } from "@/lib/hotel-image";

async function uniqueHotelSlug(base: string): Promise<string> {
  let candidate = base;
  if (RESERVED_PATH_SEGMENTS.has(candidate)) {
    candidate = `${candidate}-hotel`;
  }
  for (let i = 0; i < 12; i++) {
    const existing = await prisma.hotel.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${base.slice(0, 43)}-${suffix}`;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36).slice(-6)}`;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "hotels.view");

    const accessible = await getAccessibleHotelIds(user);
    const hotels = await prisma.hotel.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: accessible },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        country: true,
        currency: true,
        locale: true,
        timezone: true,
        imageUrl: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            products: true,
            categories: true,
            registers: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ hotels });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .union([
      z.literal(""),
      z
        .string()
        .min(2)
        .max(48)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ])
    .optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(80).optional(),
  currency: z.string().length(3).default("CHF"),
  locale: z.string().min(2).max(16).default("de-CH"),
  timezone: z.string().min(2).max(64).default("Europe/Zurich"),
});

function emptyToUndef(v: string | undefined) {
  const t = v?.trim();
  return t ? t : undefined;
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "hotels.manage");

    const contentType = req.headers.get("content-type") ?? "";
    let fields: z.infer<typeof createSchema>;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (file instanceof File && file.size > 0) imageFile = file;
      fields = {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? "") || undefined,
        address: String(form.get("address") ?? "") || undefined,
        city: String(form.get("city") ?? "") || undefined,
        country: String(form.get("country") ?? "") || undefined,
        currency: String(form.get("currency") ?? "CHF"),
        locale: String(form.get("locale") ?? "de-CH"),
        timezone: String(form.get("timezone") ?? "Europe/Zurich"),
      };
    } else {
      fields = await req.json();
    }

    const parsed = createSchema.safeParse(fields);
    if (!parsed.success) return jsonError("Validation failed", 400);
    if (!imageFile) {
      return jsonError("Hotel image is required", 400);
    }

    const { slug: requestedSlug, ...rest } = parsed.data;
    const baseSlug = emptyToUndef(requestedSlug) ?? slugifyHotelName(rest.name);
    const slug = await uniqueHotelSlug(baseSlug);

    const hotel = await prisma.hotel.create({
      data: {
        organizationId: user.organizationId,
        slug,
        name: rest.name,
        address: emptyToUndef(rest.address),
        city: emptyToUndef(rest.city),
        country: emptyToUndef(rest.country) ?? "CH",
        currency: rest.currency.toUpperCase(),
        locale: rest.locale,
        timezone: rest.timezone,
      },
    });

    let imageUrl: string;
    try {
      imageUrl = await saveHotelCoverImage(hotel.id, imageFile);
    } catch (err) {
      await prisma.hotel.delete({ where: { id: hotel.id } }).catch(() => null);
      if (err instanceof Error && err.message === "MAX_SIZE") {
        return jsonError("Max 5MB", 400);
      }
      if (err instanceof Error && err.message === "INVALID_TYPE") {
        return jsonError("Only JPEG/PNG/WebP", 400);
      }
      throw err;
    }

    const updated = await prisma.hotel.update({
      where: { id: hotel.id },
      data: { imageUrl },
    });

    await provisionNewHotel(hotel.id);

    await writeAuditLog({
      organizationId: user.organizationId,
      hotelId: hotel.id,
      userId: user.id,
      accountType: user.accountType,
      action: "hotel.create",
      entity: "Hotel",
      entityId: hotel.id,
      newValue: updated,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
