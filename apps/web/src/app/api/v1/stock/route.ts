import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { stockAdjustSchema } from "@prize/validators";
import { applyStockChange } from "@/lib/stock";
import { writeAuditLog } from "@/lib/audit";
import { getCentralWarehouse } from "@/lib/warehouse";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "stock.view");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const warehouse = await getCentralWarehouse(hotelId);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get("pageSize") ?? 100))
    );

    const where = {
      warehouseId: warehouse.id,
      ...(q
        ? {
            product: {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { sku: { contains: q, mode: "insensitive" as const } },
                { barcode: { contains: q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where,
        select: {
          id: true,
          productId: true,
          quantity: true,
          reservedQty: true,
          lastMovementAt: true,
          product: {
            select: {
              name: true,
              sku: true,
              barcode: true,
              unit: true,
              minStock: true,
              optimalStock: true,
              maxStock: true,
              purchasePrice: true,
              isActive: true,
              category: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { product: { name: "asc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockLevel.count({ where }),
    ]);

    let critical = 0;
    let belowMin = 0;
    let stockValue = 0;
    for (const row of items) {
      const qty = Number(row.quantity);
      const min = Number(row.product.minStock);
      const price = Number(row.product.purchasePrice);
      stockValue += qty * price;
      if (min > 0 && qty < min * 0.5) critical += 1;
      else if (min > 0 && qty < min) belowMin += 1;
    }

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      warehouse: { id: warehouse.id, name: warehouse.name },
      summary: {
        stockValue,
        critical,
        belowMin,
        ok: Math.max(0, items.length - critical - belowMin),
        rowCount: items.length,
      },
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
    assertPermission(user, "stock.adjust");
    const { hotelId } = await requireHotelContext(user);

    const parsed = stockAdjustSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const warehouse = await getCentralWarehouse(hotelId);
    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, hotelId: hotelId },
    });
    if (!product) return jsonError("Product not found", 404, "PRODUCT_NOT_FOUND");

    const result = await prisma.$transaction(async (tx) => {
      return applyStockChange(tx, {
        hotelId: hotelId,
        productId: parsed.data.productId,
        warehouseId: warehouse.id,
        userId: user.id,
        delta: parsed.data.quantity,
        type: "MANUAL_ADJUSTMENT",
        reason: parsed.data.reason,
      });
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "stock.adjust",
      entity: "StockLevel",
      entityId: result.id,
      newValue: {
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
        warehouseId: warehouse.id,
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error && e.message === "INSUFFICIENT_STOCK") {
      return jsonError("Nicht genügend Bestand", 400, "INSUFFICIENT_STOCK");
    }
    return jsonError("Server error", 500);
  }
}
