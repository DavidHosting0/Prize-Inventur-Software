import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { supplierSchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "suppliers.view");
    const { hotelId } = await requireHotelContext(user);

    const items = await prisma.supplier.findMany({
      where: { hotelId: hotelId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "suppliers.manage");
    const { hotelId } = await requireHotelContext(user);

    const parsed = supplierSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const email =
      parsed.data.email === "" || !parsed.data.email
        ? null
        : parsed.data.email;

    const item = await prisma.supplier.create({
      data: {
        hotelId: hotelId,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        contactName: parsed.data.contactName ?? null,
        phone: parsed.data.phone ?? null,
        email,
        leadTimeDays: parsed.data.leadTimeDays,
        minOrderValue: parsed.data.minOrderValue ?? null,
        notes: parsed.data.notes ?? null,
        isActive: parsed.data.isActive,
      },
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "supplier.create",
      entity: "Supplier",
      entityId: item.id,
      newValue: { name: item.name },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
