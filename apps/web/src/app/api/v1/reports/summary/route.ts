import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "reports.view");
    const { hotelId } = await requireHotelContext(user);

    const url = new URL(req.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
    const format = url.searchParams.get("format") ?? "json";
    const from = startOfDay(subDays(new Date(), days - 1));

    const saleWhere = {
      hotelId: hotelId,
      status: "PAID" as const,
      paidAt: { gte: from },
    };

    const [salesAgg, wasteAgg, sales, waste, movements, lowStock] =
      await Promise.all([
        prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true },
          _count: true,
        }),
        prisma.waste.aggregate({
          where: { hotelId: hotelId, createdAt: { gte: from } },
          _sum: { costValue: true },
          _count: true,
        }),
        prisma.sale.findMany({
          where: saleWhere,
          select: {
            id: true,
            transactionNo: true,
            total: true,
            paidAt: true,
            status: true,
            payments: { select: { method: true, amount: true } },
          },
          orderBy: { paidAt: "desc" },
          take: format === "csv" ? 5000 : 50,
        }),
        prisma.waste.findMany({
          where: { hotelId: hotelId, createdAt: { gte: from } },
          include: { product: { select: { name: true, sku: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.inventoryMovement.groupBy({
          by: ["type"],
          where: { hotelId: hotelId, createdAt: { gte: from } },
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.stockLevel.findMany({
          where: {
            product: { hotelId: hotelId, isActive: true },
          },
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                minStock: true,
                purchasePrice: true,
              },
            },
            warehouse: { select: { name: true, code: true } },
          },
          take: 2000,
        }),
      ]);

    const critical = lowStock
      .filter((sl) => sl.quantity.lt(sl.product.minStock))
      .map((sl) => ({
        product: sl.product.name,
        sku: sl.product.sku,
        warehouse: "LAGER",
        quantity: Number(sl.quantity),
        minStock: Number(sl.product.minStock),
        value: Number(sl.quantity) * Number(sl.product.purchasePrice),
      }));

    const summary = {
      days,
      from: from.toISOString(),
      salesCount: salesAgg._count,
      revenue: Number(salesAgg._sum.total ?? 0),
      wasteCount: wasteAgg._count,
      wasteCost: Number(wasteAgg._sum.costValue ?? 0),
      criticalCount: critical.length,
      movementsByType: movements.map((m) => ({
        type: m.type,
        count: m._count,
        quantity: Number(m._sum.quantity ?? 0),
      })),
    };

    if (format === "csv") {
      const lines = [
        "transactionNo,paidAt,paymentMethod,total",
        ...sales.map((s) => {
          const method = s.payments[0]?.method ?? "";
          return `${s.transactionNo},${s.paidAt?.toISOString() ?? ""},${method},${s.total}`;
        }),
      ];
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="sales-${days}d.csv"`,
        },
      });
    }

    return NextResponse.json({
      summary,
      sales,
      waste,
      critical: critical.slice(0, 40),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
