import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "products.edit");
    const { hotelId } = await requireHotelContext(user);

    const { id } = await ctx.params;
    const product = await prisma.product.findFirst({
      where: { id, hotelId: hotelId },
    });
    if (!product) return jsonError("Not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("file required", 400);
    if (file.size > 3_000_000) return jsonError("Max 3MB", 400);

    const type = file.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
      return jsonError("Only JPEG/PNG/WebP", 400);
    }

    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const name = `${id}-${randomBytes(6).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buf);

    const imageUrl = `/uploads/products/${name}`;
    const updated = await prisma.product.update({
      where: { id },
      data: { imageUrl },
    });

    await writeAuditLog({
      hotelId: hotelId,
      organizationId: user.organizationId,
      accountType: user.accountType,
      userId: user.id,
      action: "product.image",
      entity: "Product",
      entityId: id,
      newValue: { imageUrl },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
