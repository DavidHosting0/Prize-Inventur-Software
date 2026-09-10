import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { productSchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.view");
    const { hotelId } = await requireHotelContext(user);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("categoryId");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));

    const where = {
      hotelId: hotelId,
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
              { barcode: { contains: q, mode: "insensitive" as const } },
              { ean: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          ean: true,
          unit: true,
          salePrice: true,
          purchasePrice: true,
          isActive: true,
          trackLiquid: true,
          bottleContentMl: true,
          category: { select: { id: true, name: true } },
          stockLevels: { select: { quantity: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.create");
    const { hotelId } = await requireHotelContext(user);

    const body = await req.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        400,
        "VALIDATION"
      );
    }

    const data = parsed.data;

    const category = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, hotelId: hotelId },
    });
    if (!category) return jsonError("Category not found", 400, "CATEGORY_NOT_FOUND");

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, hotelId: hotelId },
      });
      if (!supplier)
        return jsonError("Supplier not found", 400, "SUPPLIER_NOT_FOUND");
    }

    const trackLiquid = Boolean(data.trackLiquid);
    const bottleContentMl = trackLiquid ? data.bottleContentMl ?? null : null;
    const unit = trackLiquid ? "ML" : data.unit;

    const product = await prisma.product.create({
      data: {
        hotelId: hotelId,
        name: data.name,
        sku: data.sku,
        ean: data.ean ?? null,
        barcode: data.barcode ?? null,
        categoryId: data.categoryId,
        subcategory: data.subcategory ?? null,
        description: data.description ?? null,
        unit,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        vatRate: data.vatRate,
        supplierId: data.supplierId ?? null,
        minStock: data.minStock,
        optimalStock: data.optimalStock,
        maxStock: data.maxStock,
        allergens: data.allergens,
        isActive: data.isActive,
        trackExpiry: data.trackExpiry,
        trackLiquid,
        bottleContentMl,
      },
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      newValue: { name: product.name, sku: product.sku },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return jsonError("SKU already exists", 409, "SKU_CONFLICT");
    }
    return jsonError("Server error", 500);
  }
}
