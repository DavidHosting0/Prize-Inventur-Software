import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./db";
import { startOfDay, subDays } from "date-fns";

export async function buildSalesWorkbook(hotelId: string, days: number) {
  const from = startOfDay(subDays(new Date(), days - 1));
  const sales = await prisma.sale.findMany({
    where: { hotelId, status: "PAID", paidAt: { gte: from } },
    select: {
      transactionNo: true,
      paidAt: true,
      total: true,
      currency: true,
      cashier: { select: { name: true } },
      payments: { select: { method: true }, take: 1 },
      _count: { select: { items: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 1000,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Prize Hotel";
  const sheet = wb.addWorksheet("Sales");
  sheet.columns = [
    { header: "Transaction", key: "tx", width: 18 },
    { header: "Paid At", key: "paidAt", width: 22 },
    { header: "Cashier", key: "cashier", width: 18 },
    { header: "Method", key: "method", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Items", key: "items", width: 10 },
  ];
  for (const s of sales) {
    sheet.addRow({
      tx: s.transactionNo,
      paidAt: s.paidAt?.toISOString() ?? "",
      cashier: s.cashier.name,
      method: s.payments[0]?.method ?? "",
      total: Number(s.total),
      currency: s.currency,
      items: s._count.items,
    });
  }

  const wasteSheet = wb.addWorksheet("Waste");
  const waste = await prisma.waste.findMany({
    where: { hotelId, createdAt: { gte: from } },
    select: {
      createdAt: true,
      quantity: true,
      reason: true,
      costValue: true,
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  wasteSheet.columns = [
    { header: "Date", key: "date", width: 22 },
    { header: "Product", key: "product", width: 24 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Reason", key: "reason", width: 18 },
    { header: "Cost", key: "cost", width: 12 },
  ];
  for (const w of waste) {
    wasteSheet.addRow({
      date: w.createdAt.toISOString(),
      product: w.product.name,
      sku: w.product.sku,
      qty: Number(w.quantity),
      reason: w.reason,
      cost: Number(w.costValue),
    });
  }

  const stockSheet = wb.addWorksheet("LowStock");
  const levels = await prisma.stockLevel.findMany({
    where: { product: { hotelId, isActive: true } },
    select: {
      quantity: true,
      product: { select: { name: true, sku: true, minStock: true } },
    },
    take: 1500,
  });
  stockSheet.columns = [
    { header: "Product", key: "product", width: 24 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Lager", key: "wh", width: 14 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Min", key: "min", width: 10 },
  ];
  for (const sl of levels) {
    if (!sl.quantity.lt(sl.product.minStock)) continue;
    stockSheet.addRow({
      product: sl.product.name,
      sku: sl.product.sku,
      wh: "Lager",
      qty: Number(sl.quantity),
      min: Number(sl.product.minStock),
    });
  }

  return wb.xlsx.writeBuffer();
}

export async function buildReportPdf(hotelId: string, days: number) {
  const from = startOfDay(subDays(new Date(), days - 1));
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const [salesAgg, wasteAgg, criticalCount] = await Promise.all([
    prisma.sale.aggregate({
      where: { hotelId, status: "PAID", paidAt: { gte: from } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.waste.aggregate({
      where: { hotelId, createdAt: { gte: from } },
      _sum: { costValue: true },
      _count: true,
    }),
    prisma.stockLevel.count({
      where: {
        product: { hotelId, isActive: true },
        // approximate: fetch then filter would be better; use raw for min
      },
    }),
  ]);

  const levels = await prisma.stockLevel.findMany({
    where: { product: { hotelId, isActive: true } },
    select: {
      quantity: true,
      product: { select: { minStock: true, name: true, sku: true } },
    },
    take: 800,
  });
  const critical = levels
    .filter((l) => l.quantity.lt(l.product.minStock))
    .slice(0, 25);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 800;
  const line = (text: string, size = 11, useBold = false) => {
    page.drawText(text, {
      x: 40,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= size + 8;
  };

  line("Prize Hotel — Operations Report", 16, true);
  line(`${hotel.name}  |  Last ${days} days`, 11);
  line(`Generated: ${new Date().toISOString()}`, 9);
  y -= 8;
  line(`Sales count: ${salesAgg._count}`, 12, true);
  line(`Revenue: ${Number(salesAgg._sum.total ?? 0).toFixed(2)} ${hotel.currency}`);
  line(`Waste events: ${wasteAgg._count}`);
  line(`Waste cost: ${Number(wasteAgg._sum.costValue ?? 0).toFixed(2)} ${hotel.currency}`);
  line(`Critical stock rows (sample universe ${criticalCount}): ${critical.length}`, 12, true);
  y -= 6;
  line("Critical items", 12, true);
  for (const c of critical) {
    if (y < 60) break;
    line(
      `${c.product.sku}  ${c.product.name}  qty=${Number(c.quantity)} min=${Number(c.product.minStock)}`,
      9
    );
  }

  return doc.save();
}
