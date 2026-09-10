import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { getAccessibleHotelIds, requireGroupAccount } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "dashboard.view");

    const hotelIds = await getAccessibleHotelIds(user);
    if (hotelIds.length === 0) {
      return NextResponse.json({
        hotels: 0,
        totals: {
          revenueToday: 0,
          revenueWeek: 0,
          revenueMonth: 0,
          salesToday: 0,
          stockValue: 0,
          openOrders: 0,
          wasteMonth: 0,
          criticalStock: 0,
        },
        byHotel: [],
        revenueSeries: [],
        topHotels: [],
        criticalProducts: [],
      });
    }

    const now = new Date();
    const today = startOfDay(now);
    const week = startOfWeek(now, { weekStartsOn: 1 });
    const month = startOfMonth(now);
    const seriesStart = startOfDay(subDays(now, 13));

    const hotels = await prisma.hotel.findMany({
      where: { id: { in: hotelIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        currency: true,
        imageUrl: true,
      },
      orderBy: { name: "asc" },
    });

    const paid = { status: "PAID" as const, hotelId: { in: hotelIds } };

    const [
      todayAgg,
      weekAgg,
      monthAgg,
      stockLevels,
      openOrders,
      wasteAgg,
      seriesSales,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { ...paid, paidAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { ...paid, paidAt: { gte: week } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { ...paid, paidAt: { gte: month } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.stockLevel.findMany({
        where: { warehouse: { hotelId: { in: hotelIds } } },
        select: {
          quantity: true,
          warehouse: { select: { hotelId: true } },
          product: {
            select: {
              id: true,
              name: true,
              purchasePrice: true,
              minStock: true,
              hotelId: true,
            },
          },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          hotelId: { in: hotelIds },
          status: { in: ["DRAFT", "SUBMITTED", "ORDERED"] },
        },
      }),
      prisma.waste.aggregate({
        where: { hotelId: { in: hotelIds }, createdAt: { gte: month } },
        _sum: { quantity: true },
      }),
      prisma.sale.findMany({
        where: { ...paid, paidAt: { gte: seriesStart } },
        select: { paidAt: true, total: true },
      }),
    ]);

    let stockValue = 0;
    let criticalStock = 0;
    const stockByHotel = new Map<string, number>();
    const criticalByHotel = new Map<string, number>();
    const qtyByProduct = new Map<
      string,
      { id: string; name: string; hotelId: string; qty: number; min: number }
    >();

    for (const row of stockLevels) {
      const hid = row.warehouse.hotelId;
      const val = Number(row.quantity) * Number(row.product.purchasePrice);
      stockValue += val;
      stockByHotel.set(hid, (stockByHotel.get(hid) ?? 0) + val);

      const pid = row.product.id;
      const prev = qtyByProduct.get(pid);
      const qty = (prev?.qty ?? 0) + Number(row.quantity);
      qtyByProduct.set(pid, {
        id: pid,
        name: row.product.name,
        hotelId: row.product.hotelId,
        qty,
        min: Number(row.product.minStock),
      });
    }

    for (const p of qtyByProduct.values()) {
      if (p.qty < p.min) {
        criticalStock += 1;
        criticalByHotel.set(p.hotelId, (criticalByHotel.get(p.hotelId) ?? 0) + 1);
      }
    }

    const hotelNameById = new Map(hotels.map((h) => [h.id, h.name]));
    const criticalProducts = [...qtyByProduct.values()]
      .filter((p) => p.qty < p.min)
      .sort((a, b) => b.min - b.qty - (a.min - a.qty))
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        hotelName: hotelNameById.get(p.hotelId) ?? "—",
        qty: p.qty,
        min: p.min,
      }));

    const revenueByHotel = await prisma.sale.groupBy({
      by: ["hotelId"],
      where: { ...paid, paidAt: { gte: month } },
      _sum: { total: true },
      _count: true,
    });
    const revMap = new Map(
      revenueByHotel.map((r) => [
        r.hotelId,
        { amount: Number(r._sum.total ?? 0), count: r._count },
      ])
    );

    const wasteByHotel = await prisma.waste.groupBy({
      by: ["hotelId"],
      where: { hotelId: { in: hotelIds }, createdAt: { gte: month } },
      _sum: { quantity: true },
    });
    const wasteMap = new Map(
      wasteByHotel.map((w) => [w.hotelId, Number(w._sum.quantity ?? 0)])
    );

    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      byDay.set(startOfDay(subDays(now, i)).toISOString().slice(0, 10), 0);
    }
    for (const sale of seriesSales) {
      if (!sale.paidAt) continue;
      const key = startOfDay(sale.paidAt).toISOString().slice(0, 10);
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + Number(sale.total));
      }
    }

    const byHotel = hotels.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      currency: h.currency,
      imageUrl: h.imageUrl,
      revenueMonth: revMap.get(h.id)?.amount ?? 0,
      salesMonth: revMap.get(h.id)?.count ?? 0,
      stockValue: stockByHotel.get(h.id) ?? 0,
      criticalStock: criticalByHotel.get(h.id) ?? 0,
      wasteMonth: wasteMap.get(h.id) ?? 0,
    }));

    const topHotels = [...byHotel]
      .sort((a, b) => b.revenueMonth - a.revenueMonth)
      .slice(0, 6)
      .map((h) => ({
        name: h.name,
        revenue: h.revenueMonth,
      }));

    return NextResponse.json({
      organizationId: user.organizationId,
      hotels: hotels.length,
      totals: {
        revenueToday: Number(todayAgg._sum.total ?? 0),
        revenueWeek: Number(weekAgg._sum.total ?? 0),
        revenueMonth: Number(monthAgg._sum.total ?? 0),
        salesToday: todayAgg._count,
        stockValue,
        openOrders,
        wasteMonth: Number(wasteAgg._sum.quantity ?? 0),
        criticalStock,
      },
      byHotel,
      revenueSeries: [...byDay.entries()].map(([date, amount]) => ({
        date,
        amount,
      })),
      topHotels,
      criticalProducts,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
