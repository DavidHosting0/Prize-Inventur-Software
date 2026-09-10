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
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/audit";

const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  username: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().cuid(),
  isActive: z.boolean().default(true),
  locale: z.enum(["de", "en"]).default("de"),
});

/**
 * Hotel-scoped user admin: only HOTEL accounts of this hotel.
 * GROUP / corporate users are never listed or creatable here.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "users.manage");
    const { hotelId } = await requireHotelContext(user);

    const [items, roles] = await Promise.all([
      prisma.user.findMany({
        where: {
          accountType: "HOTEL",
          hotels: { some: { hotelId } },
        },
        include: { role: true },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({
        where: { scope: "HOTEL" },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        isActive: u.isActive,
        locale: u.locale,
        accountType: u.accountType,
        role: u.role,
      })),
      roles,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return jsonError("Unauthorized", 401);
    assertPermission(sessionUser, "users.manage");
    const { hotelId } = await requireHotelContext(sessionUser);

    const parsed = createUserSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const role = await prisma.role.findUnique({
      where: { id: parsed.data.roleId },
    });
    if (!role) return jsonError("Role not found", 400);
    if (role.scope !== "HOTEL") {
      return jsonError(
        "Only hotel roles can be assigned in hotel user management",
        403,
        "HOTEL_ROLE_REQUIRED"
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        roleId: parsed.data.roleId,
        organizationId: sessionUser.organizationId,
        accountType: "HOTEL",
        isActive: parsed.data.isActive,
        locale: parsed.data.locale,
        hotels: {
          create: { hotelId, isDefault: true },
        },
      },
      include: { role: true },
    });

    await writeAuditLog({
      hotelId,
      organizationId: sessionUser.organizationId,
      accountType: sessionUser.accountType,
      userId: sessionUser.id,
      action: "user.create",
      entity: "User",
      entityId: created.id,
      newValue: {
        email: created.email,
        role: role.code,
        accountType: "HOTEL",
        hotelId,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        username: created.username,
        email: created.email,
        isActive: created.isActive,
        accountType: created.accountType,
        role: created.role,
      },
      { status: 201 }
    );
  } catch (e) {
    if (isNextResponse(e)) return e;
    // Unique constraint (email/username)
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return jsonError("Email or username already exists", 409, "DUPLICATE");
    }
    return jsonError("Server error", 500);
  }
}
