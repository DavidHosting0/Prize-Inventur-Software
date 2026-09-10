import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { getAccessibleHotelIds, requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "analytics.view");

    const url = new URL(req.url);
    const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days") ?? 30)));
    const from = startOfDay(subDays(new Date(), days - 1));

    const hotelIds = await getAccessibleHotelIds(user);
    const hotels = await prisma.hotel.findMany({
      where: { id: { in: hotelIds } },
      select: { id: true, name: true, currency: true },
      orderBy: { name: "asc" },
    });

    if (hotelIds.length === 0) {
      return NextResponse.json({ days, from, byHotel: [], series: [] });
    }

    const [salesByHotel, wasteByHotel, ordersByHotel, stockLevels, seriesSales] =
      await Promise.all([
        prisma.sale.groupBy({
          by: ["hotelId"],
          where: {
            hotelId: { in: hotelIds },
            status: "PAID",
            paidAt: { gte: from },
          },
          _sum: { total: true },
          _count: true,
        }),
        prisma.waste.groupBy({
          by: ["hotelId"],
          where: { hotelId: { in: hotelIds }, createdAt: { gte: from } },
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.purchaseOrder.groupBy({
          by: ["hotelId"],
          where: { hotelId: { in: hotelIds }, createdAt: { gte: from } },
          _count: true,
        }),
        prisma.stockLevel.findMany({
          where: { warehouse: { hotelId: { in: hotelIds } } },
          select: {
            quantity: true,
            warehouse: { select: { hotelId: true } },
            product: { select: { purchasePrice: true } },
          },
        }),
        prisma.sale.findMany({
          where: {
            hotelId: { in: hotelIds },
            status: "PAID",
            paidAt: { gte: from },
          },
          select: { hotelId: true, paidAt: true, total: true },
        }),
      ]);

    const salesMap = new Map(
      salesByHotel.map((s) => [
        s.hotelId,
        { revenue: Number(s._sum.total ?? 0), sales: s._count },
      ])
    );
    const wasteMap = new Map(
      wasteByHotel.map((w) => [
        w.hotelId,
        { qty: Number(w._sum.quantity ?? 0), count: w._count },
      ])
    );
    const ordersMap = new Map(
      ordersByHotel.map((o) => [o.hotelId, o._count])
    );
    const stockMap = new Map<string, number>();
    for (const row of stockLevels) {
      const hid = row.warehouse.hotelId;
      const val = Number(row.quantity) * Number(row.product.purchasePrice);
      stockMap.set(hid, (stockMap.get(hid) ?? 0) + val);
    }

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const seriesMap = new Map<string, number>();
    for (const s of seriesSales) {
      if (!s.paidAt) continue;
      const key = dayKey(s.paidAt);
      seriesMap.set(key, (seriesMap.get(key) ?? 0) + Number(s.total));
    }
    const series = Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      const key = dayKey(startOfDay(d));
      return { date: key, revenue: seriesMap.get(key) ?? 0 };
    });

    return NextResponse.json({
      days,
      from,
      byHotel: hotels.map((h) => ({
        id: h.id,
        name: h.name,
        currency: h.currency,
        revenue: salesMap.get(h.id)?.revenue ?? 0,
        sales: salesMap.get(h.id)?.sales ?? 0,
        inventoryValue: stockMap.get(h.id) ?? 0,
        wasteQty: wasteMap.get(h.id)?.qty ?? 0,
        wasteCount: wasteMap.get(h.id)?.count ?? 0,
        purchaseOrders: ordersMap.get(h.id) ?? 0,
      })),
      series,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
