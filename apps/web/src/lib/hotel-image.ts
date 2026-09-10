import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function saveHotelCoverImage(
  hotelId: string,
  file: File
): Promise<string> {
  if (file.size > 5_000_000) {
    throw new Error("MAX_SIZE");
  }
  const type = file.type;
  if (!ALLOWED.has(type)) {
    throw new Error("INVALID_TYPE");
  }

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const name = `${hotelId}-${randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "hotels");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  return `/uploads/hotels/${name}`;
}
