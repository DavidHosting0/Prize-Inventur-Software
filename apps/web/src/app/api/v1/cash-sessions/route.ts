import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { cashCloseSchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";
import { startOfDay } from "date-fns";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "cash.close");
    const { hotelId } = await requireHotelContext(user);

    const session = await prisma.cashSession.findFirst({
      where: {
        status: "OPEN",
        cashRegister: { hotelId: hotelId },
      },
      include: { cashRegister: true },
      orderBy: { openedAt: "desc" },
    });

    if (!session) {
      return NextResponse.json({ session: null, totals: null });
    }

    const payments = await prisma.payment.findMany({
      where: {
        sale: {
          hotelId: hotelId,
          status: "PAID",
          cashSessionId: session.id,
        },
      },
    });

    const totals = { CASH: 0, CARD: 0, TWINT: 0, OFFLINE: 0, OTHER: 0, TOTAL: 0 };
    for (const p of payments) {
      totals[p.method] += Number(p.amount);
      totals.TOTAL += Number(p.amount);
    }

    return NextResponse.json({
      session,
      totals,
      expectedCash: totals.CASH,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "cash.close");
    const { hotelId } = await requireHotelContext(user);

    const parsed = cashCloseSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const session = await prisma.cashSession.findFirst({
      where: {
        status: "OPEN",
        cashRegister: { hotelId: hotelId },
      },
      include: { cashRegister: true },
      orderBy: { openedAt: "desc" },
    });
    if (!session) return jsonError("No open session", 400);

    const payments = await prisma.payment.findMany({
      where: {
        sale: {
          hotelId: hotelId,
          status: "PAID",
          cashSessionId: session.id,
        },
      },
    });

    const totalsByMethod: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      TWINT: 0,
      OFFLINE: 0,
      OTHER: 0,
    };
    for (const p of payments) {
      totalsByMethod[p.method] =
        (totalsByMethod[p.method] ?? 0) + Number(p.amount);
    }

    const expectedCash = totalsByMethod.CASH ?? 0;
    const countedCash = parsed.data.countedCash;
    const cashDifference = countedCash - expectedCash;

    const closed = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        expectedCash,
        countedCash,
        cashDifference,
        totalsByMethod,
        notes: parsed.data.notes ?? null,
      },
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "cash.close",
      entity: "CashSession",
      entityId: session.id,
      newValue: {
        expectedCash,
        countedCash,
        cashDifference,
        totalsByMethod,
      },
    });

    return NextResponse.json(closed);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
