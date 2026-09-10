import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { Prisma } from "@prisma/client";

type DashRow = {
  revenue_today: Prisma.Decimal | number | null;
  sales_today: bigint | number;
  revenue_week: Prisma.Decimal | number | null;
  revenue_month: Prisma.Decimal | number | null;
  stock_value: Prisma.Decimal | number | null;
  critical: bigint | number;
  below_min: bigint | number;
  open_counts: bigint | number;
  open_receipts: bigint | number;
  open_orders: bigint | number;
  food_waste: Prisma.Decimal | number | null;
};

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "dashboard.view");
    const { hotelId } = await requireHotelContext(user);

    const now = new Date();
    const today = startOfDay(now);
    const week = startOfWeek(now, { weekStartsOn: 1 });
    const month = startOfMonth(now);
    const seriesFrom = startOfDay(subDays(now, 13));

    const [kpiRows, criticalProducts, seriesRows, topProducts, recentMovements, alerts] =
      await Promise.all([
        prisma.$queryRaw<DashRow[]>`
          SELECT
            (
              SELECT COALESCE(SUM(s.total), 0) FROM "Sale" s
              WHERE s."hotelId" = ${hotelId} AND s.status = 'PAID' AND s."paidAt" >= ${today}
            ) AS revenue_today,
            (
              SELECT COUNT(*)::int FROM "Sale" s
              WHERE s."hotelId" = ${hotelId} AND s.status = 'PAID' AND s."paidAt" >= ${today}
            ) AS sales_today,
            (
              SELECT COALESCE(SUM(s.total), 0) FROM "Sale" s
              WHERE s."hotelId" = ${hotelId} AND s.status = 'PAID' AND s."paidAt" >= ${week}
            ) AS revenue_week,
            (
              SELECT COALESCE(SUM(s.total), 0) FROM "Sale" s
              WHERE s."hotelId" = ${hotelId} AND s.status = 'PAID' AND s."paidAt" >= ${month}
            ) AS revenue_month,
            (
              SELECT COALESCE(SUM(sl.quantity * p."purchasePrice"), 0)
              FROM "StockLevel" sl
              INNER JOIN "Product" p ON p.id = sl."productId"
              INNER JOIN "Warehouse" w ON w.id = sl."warehouseId"
              WHERE w."hotelId" = ${hotelId}
            ) AS stock_value,
            (
              SELECT COUNT(*)::int
              FROM "StockLevel" sl
              INNER JOIN "Product" p ON p.id = sl."productId"
              INNER JOIN "Warehouse" w ON w.id = sl."warehouseId"
              WHERE w."hotelId" = ${hotelId}
                AND p."minStock" > 0 AND sl.quantity <= p."minStock" * 0.5
            ) AS critical,
            (
              SELECT COUNT(*)::int
              FROM "StockLevel" sl
              INNER JOIN "Product" p ON p.id = sl."productId"
              INNER JOIN "Warehouse" w ON w.id = sl."warehouseId"
              WHERE w."hotelId" = ${hotelId}
                AND p."minStock" > 0
                AND sl.quantity < p."minStock"
                AND sl.quantity > p."minStock" * 0.5
            ) AS below_min,
            (
              SELECT COUNT(*)::int FROM "InventoryCount" ic
              WHERE ic."hotelId" = ${hotelId}
                AND ic.status IN ('IN_PROGRESS', 'REVIEW', 'DRAFT')
            ) AS open_counts,
            (
              SELECT COUNT(*)::int FROM "GoodsReceipt" gr
              WHERE gr."hotelId" = ${hotelId} AND gr.status = 'DRAFT'
            ) AS open_receipts,
            (
              SELECT COUNT(*)::int FROM "PurchaseOrder" po
              WHERE po."hotelId" = ${hotelId}
                AND po.status IN ('DRAFT', 'ORDERED', 'PARTIAL')
            ) AS open_orders,
            (
              SELECT COALESCE(SUM(w."costValue"), 0) FROM "Waste" w
              WHERE w."hotelId" = ${hotelId} AND w."createdAt" >= ${today}
            ) AS food_waste
        `,
        prisma.$queryRaw<
          Array<{
            id: string;
            name: string;
            qty: Prisma.Decimal | number;
            min: Prisma.Decimal | number;
          }>
        >`
          SELECT
            p.id,
            p.name,
            sl.quantity AS qty,
            p."minStock" AS min
          FROM "StockLevel" sl
          INNER JOIN "Product" p ON p.id = sl."productId"
          INNER JOIN "Warehouse" w ON w.id = sl."warehouseId"
          WHERE w."hotelId" = ${hotelId}
            AND p."minStock" > 0
            AND sl.quantity < p."minStock"
          ORDER BY (sl.quantity / NULLIF(p."minStock", 0)) ASC
          LIMIT 10
        `,
        prisma.$queryRaw<
          Array<{ day: Date; amount: Prisma.Decimal | number | null }>
        >`
          SELECT date_trunc('day', s."paidAt") AS day,
                 COALESCE(SUM(s.total), 0) AS amount
          FROM "Sale" s
          WHERE s."hotelId" = ${hotelId}
            AND s.status = 'PAID'
            AND s."paidAt" >= ${seriesFrom}
          GROUP BY 1
          ORDER BY 1
        `,
        prisma.saleItem.groupBy({
          by: ["productId", "nameSnapshot"],
          where: {
            sale: { hotelId: hotelId, status: "PAID", paidAt: { gte: week } },
          },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { lineTotal: "desc" } },
          take: 5,
        }),
        prisma.inventoryMovement.findMany({
          where: { hotelId: hotelId },
          select: {
            id: true,
            type: true,
            quantity: true,
            reason: true,
            createdAt: true,
            product: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.notification.findMany({
          where: { hotelId: hotelId, isRead: false },
          select: { id: true, title: true, body: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

    const k = kpiRows[0];
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      byDay.set(startOfDay(subDays(now, i)).toISOString().slice(0, 10), 0);
    }
    for (const row of seriesRows) {
      const key = startOfDay(new Date(row.day)).toISOString().slice(0, 10);
      if (byDay.has(key)) {
        byDay.set(key, Number(row.amount ?? 0));
      }
    }

    return NextResponse.json({
      currency: user.currency,
      locale: user.hotelLocale,
      kpis: {
        revenueToday: Number(k?.revenue_today ?? 0),
        revenueWeek: Number(k?.revenue_week ?? 0),
        revenueMonth: Number(k?.revenue_month ?? 0),
        salesCount: Number(k?.sales_today ?? 0),
        stockValue: Number(k?.stock_value ?? 0),
        criticalItems: Number(k?.critical ?? 0),
        belowMin: Number(k?.below_min ?? 0),
        openInventoryCounts: Number(k?.open_counts ?? 0),
        openOrders: Number(k?.open_orders ?? 0),
        openReceipts: Number(k?.open_receipts ?? 0),
        foodWaste: Number(k?.food_waste ?? 0),
      },
      revenueSeries: [...byDay.entries()].map(([date, amount]) => ({
        date,
        amount,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: p.nameSnapshot,
        qty: Number(p._sum.quantity ?? 0),
        revenue: Number(p._sum.lineTotal ?? 0),
      })),
      recentMovements,
      alerts,
      criticalProducts: criticalProducts.map((p) => ({
        id: p.id,
        name: p.name,
        qty: Number(p.qty),
        min: Number(p.min),
      })),
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
