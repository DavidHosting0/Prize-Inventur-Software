import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { inventoryCountCreateSchema } from "@prize/validators";
import {
  createInventoryCount,
  loadInventoryProgress,
} from "@/lib/inventory";
import { getHotelInventorySettings } from "@/lib/inventory-settings";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "inventory.view");
    const { hotelId } = await requireHotelContext(user);

    const [items, settings] = await Promise.all([
      prisma.inventoryCount.findMany({
        where: { hotelId: hotelId },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      getHotelInventorySettings(hotelId),
    ]);

    const progress = await loadInventoryProgress(
      hotelId,
      items.map((i) => i.id)
    );

    return NextResponse.json({
      inventorySettings: settings,
      items: items.map((c) => {
        const p = progress.get(c.id);
        return {
          ...c,
          progress: {
            itemCount: p?.itemCount ?? c._count.items,
            countedCount: p?.countedCount ?? 0,
            diffCount: p?.diffCount ?? 0,
            valueDiffSum: p?.valueDiffSum ?? 0,
          },
        };
      }),
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
    assertPermission(user, "inventory.create");
    await requireHotelContext(user);

    const parsed = inventoryCountCreateSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const count = await createInventoryCount(user, parsed.data);
    return NextResponse.json(count, { status: 201 });
  } catch (e) {
    if (isNextResponse(e)) return e;
    if (e instanceof Error) return jsonError(e.message, 400);
    return jsonError("Server error", 500);
  }
}
