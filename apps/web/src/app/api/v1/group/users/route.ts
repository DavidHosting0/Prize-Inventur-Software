import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/audit";

/**
 * Group / corporate user admin: only GROUP accounts in the organization.
 * Hotel staff are managed inside each hotel, not here.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "users.view");

    const [users, roles, hotels] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          accountType: "GROUP",
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          accountType: true,
          isActive: true,
          locale: true,
          role: { select: { id: true, code: true, name: true, scope: true } },
          hotels: {
            select: {
              isDefault: true,
              hotel: { select: { id: true, name: true, slug: true } },
            },
          },
          createdAt: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({
        where: { scope: "GROUP" },
        orderBy: { name: "asc" },
      }),
      prisma.hotel.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ users, roles, hotels });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  username: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().cuid(),
  isActive: z.boolean().default(true),
  locale: z.enum(["de", "en"]).default("de"),
  /** Optional hotel allow-list (for roles without hotels.view_all) */
  hotelIds: z.array(z.string().cuid()).optional(),
});

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return jsonError("Unauthorized", 401);
    requireGroupAccount(sessionUser);
    const canCreate =
      sessionUser.roleCode === "GROUP_ADMIN" ||
      sessionUser.permissions.includes("users.create") ||
      sessionUser.permissions.includes("users.manage");
    if (!canCreate) {
      return jsonError("Forbidden", 403, "FORBIDDEN");
    }

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const role = await prisma.role.findUnique({
      where: { id: parsed.data.roleId },
    });
    if (!role) return jsonError("Role not found", 400);
    if (role.scope !== "GROUP") {
      return jsonError(
        "Only group roles can be assigned in corporate user management",
        403,
        "GROUP_ROLE_REQUIRED"
      );
    }

    const hotelIds = parsed.data.hotelIds ?? [];
    if (hotelIds.length > 0) {
      const count = await prisma.hotel.count({
        where: {
          id: { in: hotelIds },
          organizationId: sessionUser.organizationId,
        },
      });
      if (count !== hotelIds.length) {
        return jsonError("Invalid hotel selection", 400, "HOTEL_INVALID");
      }
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
        accountType: "GROUP",
        isActive: parsed.data.isActive,
        locale: parsed.data.locale,
        hotels:
          hotelIds.length > 0
            ? {
                create: hotelIds.map((hotelId, i) => ({
                  hotelId,
                  isDefault: i === 0,
                })),
              }
            : undefined,
      },
      include: {
        role: true,
        hotels: { include: { hotel: { select: { id: true, name: true } } } },
      },
    });

    await writeAuditLog({
      organizationId: sessionUser.organizationId,
      accountType: sessionUser.accountType,
      userId: sessionUser.id,
      action: "user.create",
      entity: "User",
      entityId: created.id,
      newValue: {
        email: created.email,
        role: role.code,
        accountType: "GROUP",
        hotelIds,
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
        hotels: created.hotels,
      },
      { status: 201 }
    );
  } catch (e) {
    if (isNextResponse(e)) return e;
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
