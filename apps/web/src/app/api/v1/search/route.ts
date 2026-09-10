import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "search.use");
    const { hotelId } = await requireHotelContext(user);

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const [products, sales, counts, users] = await Promise.all([
      prisma.product.findMany({
        where: {
          hotelId: hotelId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
      }),
      prisma.sale.findMany({
        where: {
          hotelId: hotelId,
          OR: [
            { transactionNo: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.inventoryCount.findMany({
        where: {
          hotelId: hotelId,
          name: { contains: q, mode: "insensitive" },
        },
        take: 5,
      }),
      prisma.user.findMany({
        where: {
          hotels: { some: { hotelId: hotelId } },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      results: [
        ...products.map((p) => ({
          type: "product",
          id: p.id,
          title: p.name,
          subtitle: p.sku,
          href: `/products/${p.id}`,
        })),
        ...sales.map((s) => ({
          type: "transaction",
          id: s.id,
          title: s.transactionNo,
          subtitle: s.status,
          href: `/pos/receipt/${s.id}`,
        })),
        ...counts.map((c) => ({
          type: "inventory",
          id: c.id,
          title: c.name,
          subtitle: c.status,
          href: `/inventory/${c.id}`,
        })),
        ...users.map((u) => ({
          type: "user",
          id: u.id,
          title: u.name,
          subtitle: u.email,
          href: `/users`,
        })),
      ],
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
