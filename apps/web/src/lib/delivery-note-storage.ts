import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function saveDeliveryNoteImage(opts: {
  hotelId: string;
  scanId: string;
  pageIndex: number;
  file: File;
}): Promise<{
  imageUrl: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
}> {
  const type = opts.file.type;
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new Error("INVALID_IMAGE_TYPE");
  }
  if (opts.file.size > 8_000_000) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const ext =
    type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const name = `${opts.scanId}-p${opts.pageIndex}-${randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "delivery-notes",
    opts.hotelId
  );
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await opts.file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);

  return {
    imageUrl: `/uploads/delivery-notes/${opts.hotelId}/${name}`,
    mimeType: type,
    fileSize: opts.file.size,
    fileHash: sha256(buf),
  };
}

export function combinePageHashes(hashes: string[]): string {
  return sha256(hashes.join("|"));
}
