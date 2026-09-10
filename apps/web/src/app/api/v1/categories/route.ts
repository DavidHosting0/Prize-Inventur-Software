import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { productCategorySchema } from "@prize/validators";
import { writeAuditLog } from "@/lib/audit";

function slugCode(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return base || "CAT";
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.view");
    const { hotelId } = await requireHotelContext(user);

    const categories = await prisma.productCategory.findMany({
      where: { hotelId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ items: categories });
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

    const parsed = productCategorySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        400,
        "VALIDATION"
      );
    }

    const name = parsed.data.name.trim();
    let code = (parsed.data.code ?? slugCode(name)).toUpperCase();

    const max = await prisma.productCategory.aggregate({
      where: { hotelId },
      _max: { sortOrder: true },
    });

    let created;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? code : `${code.slice(0, 20)}_${attempt}`;
      try {
        created = await prisma.productCategory.create({
          data: {
            hotelId,
            name,
            code: candidate,
            sortOrder: parsed.data.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
          },
        });
        break;
      } catch (e) {
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }
    if (!created) {
      return jsonError("Category code conflict", 409, "CODE_CONFLICT");
    }

    await writeAuditLog({
      hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "product_category.create",
      entity: "ProductCategory",
      entityId: created.id,
      newValue: { name: created.name, code: created.code },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
