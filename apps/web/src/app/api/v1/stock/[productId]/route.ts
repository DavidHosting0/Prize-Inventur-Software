import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getCentralWarehouse } from "@/lib/warehouse";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "stock.view");
    const { hotelId } = await requireHotelContext(user);
    const { productId } = await ctx.params;

    const warehouse = await getCentralWarehouse(hotelId);

    const product = await prisma.product.findFirst({
      where: { id: productId, hotelId },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        purchasePrice: true,
        salePrice: true,
        minStock: true,
        optimalStock: true,
        maxStock: true,
        imageUrl: true,
        description: true,
        isActive: true,
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
    if (!product) return jsonError("Product not found", 404, "PRODUCT_NOT_FOUND");

    const [stockLevel, movements, deliveries] = await Promise.all([
      prisma.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: warehouse.id,
          },
        },
        select: {
          id: true,
          quantity: true,
          reservedQty: true,
          lastMovementAt: true,
          updatedAt: true,
        },
      }),
      prisma.inventoryMovement.findMany({
        where: { hotelId, productId, warehouseId: warehouse.id },
        select: {
          id: true,
          type: true,
          quantity: true,
          quantityBefore: true,
          quantityAfter: true,
          reason: true,
          referenceType: true,
          referenceId: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.goodsReceiptItem.findMany({
        where: {
          productId,
          goodsReceipt: { hotelId, warehouseId: warehouse.id },
        },
        select: {
          id: true,
          qtyOrdered: true,
          qtyDelivered: true,
          qtyDamaged: true,
          qtyMissing: true,
          purchasePrice: true,
          expiryDate: true,
          batchNo: true,
          goodsReceipt: {
            select: {
              id: true,
              deliveryNoteNo: true,
              status: true,
              receivedAt: true,
              confirmedAt: true,
              notes: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { goodsReceipt: { receivedAt: "desc" } },
        take: 40,
      }),
    ]);

    // Chronological series for a simple stock-level sparkline (oldest → newest)
    const historyAsc = [...movements]
      .reverse()
      .map((m) => ({
        at: m.createdAt,
        quantityAfter: m.quantityAfter,
        type: m.type,
      }));

    return NextResponse.json({
      product,
      warehouse: { id: warehouse.id, name: warehouse.name },
      stockLevel: stockLevel ?? {
        id: null,
        quantity: "0",
        reservedQty: "0",
        lastMovementAt: null,
        updatedAt: null,
      },
      movements,
      deliveries,
      history: historyAsc,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
